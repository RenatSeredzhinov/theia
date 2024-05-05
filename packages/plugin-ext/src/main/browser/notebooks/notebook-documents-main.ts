// *****************************************************************************
// Copyright (C) 2023 TypeFox and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { DisposableCollection, Event } from '@theia/core';
import { URI, UriComponents } from '@theia/core/lib/common/uri';
import { inject, named, postConstruct } from '@theia/core/shared/inversify';
import { NotebookModelResolverService } from '@theia/notebook/lib/browser';
import { NotebookModel } from '@theia/notebook/lib/browser/view-model/notebook-model';
import { NotebookCellsChangeType } from '@theia/notebook/lib/common';
import { NotebookMonacoTextModelService } from '@theia/notebook/lib/browser/service/notebook-monaco-text-model-service';
import { MAIN_RPC_CONTEXT, NotebookCellsChangedEventDto, NotebookDataDto, NotebookDocumentsExt, NotebookDocumentsMain } from '../../../common';
import { RPCProxy } from '../../../common/rpc-protocol';
import { NotebookDto } from './notebook-dto';
import { MonacoEditorModel } from '@theia/monaco/lib/browser/monaco-editor-model';

export class NotebookDocumentsMainImpl implements NotebookDocumentsMain {

    @inject(RPCProxy)
    @named(MAIN_RPC_CONTEXT.NOTEBOOK_DOCUMENTS_EXT.id)
    protected readonly proxy: NotebookDocumentsExt;
    @inject(NotebookModelResolverService)
    protected readonly notebookModelResolverService: NotebookModelResolverService;
    @inject(NotebookMonacoTextModelService)
    protected notebookMonacoTextModelService: NotebookMonacoTextModelService;

    protected readonly documentEventListenersMapping = new Map<string, DisposableCollection>();
    protected readonly disposables = new DisposableCollection();

    @postConstruct()
    protected init(): void {
        // forward dirty and save events
        this.disposables.push(this.notebookModelResolverService.onDidChangeDirty(model => this.proxy.$acceptDirtyStateChanged(model.uri.toComponents(), model.isDirty())));
        this.disposables.push(this.notebookModelResolverService.onDidSaveNotebook(e => this.proxy.$acceptModelSaved(e)));
    }

    get onDidAddNotebookCellModel(): Event<MonacoEditorModel> {
        return this.notebookMonacoTextModelService.onDidCreateNotebookCellModel;
    }

    dispose(): void {
        this.disposables.dispose();
        // this.modelReferenceCollection.dispose();
        this.documentEventListenersMapping.forEach(value => value.dispose());
    }

    handleNotebooksAdded(notebooks: readonly NotebookModel[]): void {

        for (const notebook of notebooks) {
            const listener = notebook.onDidChangeContent(events => {

                const eventDto: NotebookCellsChangedEventDto = {
                    versionId: 1, // TODO implement version ID support
                    rawEvents: []
                };

                for (const e of events) {

                    switch (e.kind) {
                        case NotebookCellsChangeType.ModelChange:
                            eventDto.rawEvents.push({
                                kind: e.kind,
                                changes: e.changes.map(diff =>
                                    ({ ...diff, newItems: diff.newItems.map(NotebookDto.toNotebookCellDto) }))
                            });
                            break;
                        case NotebookCellsChangeType.Move:
                            eventDto.rawEvents.push({
                                kind: e.kind,
                                index: e.index,
                                length: e.length,
                                newIdx: e.newIdx,
                            });
                            break;
                        case NotebookCellsChangeType.Output:
                            eventDto.rawEvents.push({
                                kind: e.kind,
                                index: e.index,
                                outputs: e.outputs.map(NotebookDto.toNotebookOutputDto)
                            });
                            break;
                        case NotebookCellsChangeType.OutputItem:
                            eventDto.rawEvents.push({
                                kind: e.kind,
                                index: e.index,
                                outputId: e.outputId,
                                outputItems: e.outputItems.map(NotebookDto.toNotebookOutputItemDto),
                                append: e.append
                            });
                            break;
                        case NotebookCellsChangeType.ChangeCellLanguage:
                        case NotebookCellsChangeType.ChangeCellContent:
                        case NotebookCellsChangeType.ChangeCellMetadata:
                        case NotebookCellsChangeType.ChangeCellInternalMetadata:
                            eventDto.rawEvents.push(e);
                            break;
                        case NotebookCellsChangeType.ChangeDocumentMetadata:
                            eventDto.rawEvents.push({
                                kind: e.kind,
                                metadata: e.metadata
                            });
                            break;
                    }
                }

                const hasDocumentMetadataChangeEvent = events.find(e => e.kind === NotebookCellsChangeType.ChangeDocumentMetadata);

                // using the model resolver service to know if the model is dirty or not.
                // assuming this is the first listener it can mean that at first the model
                // is marked as dirty and that another event is fired
                this.proxy.$acceptModelChanged(
                    notebook.uri.toComponents(),
                    eventDto,
                    notebook.isDirty(),
                    hasDocumentMetadataChangeEvent ? notebook.metadata : undefined
                );
            });

            this.documentEventListenersMapping.set(notebook.uri.toString(), new DisposableCollection(listener));
        }
    }

    handleNotebooksRemoved(uris: UriComponents[]): void {
        for (const uri of uris) {
            this.documentEventListenersMapping.get(uri.toString())?.dispose();
            this.documentEventListenersMapping.delete(uri.toString());
        }
    }

    async $tryCreateNotebook(options: { viewType: string; content?: NotebookDataDto }): Promise<UriComponents> {
        const ref = await this.notebookModelResolverService.resolveUntitledResource({ untitledResource: undefined }, options.viewType);

        // untitled notebooks are disposed when they get saved. we should not hold a reference
        // to such a disposed notebook and therefore dispose the reference as well
        // ref.onWillDispose(() => {
        //     ref.dispose();
        // });

        // untitled notebooks are dirty by default
        this.proxy.$acceptDirtyStateChanged(ref.uri.toComponents(), true);

        // apply content changes... slightly HACKY -> this triggers a change event
        // if (options.content) {
        //     const data = NotebookDto.fromNotebookDataDto(options.content);
        //     ref.notebook.reset(data.cells, data.metadata, ref.object.notebook.transientOptions);
        // }
        return ref.uri.toComponents();
    }

    async $tryOpenNotebook(uriComponents: UriComponents): Promise<UriComponents> {
        const uri = URI.fromComponents(uriComponents);
        return uri.toComponents();
    }

    async $trySaveNotebook(uriComponents: UriComponents): Promise<boolean> {
        const uri = URI.fromComponents(uriComponents);

        const ref = await this.notebookModelResolverService.resolve(uri);
        await ref.save({});
        ref.dispose();
        return true;
    }
}
