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

import { DisposableCollection } from '@theia/core';
import { inject, injectable, named, postConstruct } from '@theia/core/shared/inversify';
import { NotebookRendererMessagingService } from '@theia/notebook/lib/browser';
import { MAIN_RPC_CONTEXT, NotebookRenderersExt, NotebookRenderersMain } from '../../../common';
import { RPCProxy } from '../../../common/rpc-protocol';

@injectable()
export class NotebookRenderersMainImpl implements NotebookRenderersMain {

    @inject(RPCProxy)
    @named(MAIN_RPC_CONTEXT.NOTEBOOK_RENDERERS_EXT.id)
    private readonly proxy: NotebookRenderersExt;
    @inject(NotebookRendererMessagingService)
    private readonly rendererMessagingService: NotebookRendererMessagingService;

    private readonly disposables = new DisposableCollection();

    @postConstruct()
    protected init(): void {
        this.rendererMessagingService.onPostMessage(e => {
            this.proxy.$postRendererMessage(e.editorId, e.rendererId, e.message);
        });
    }

    $postMessage(editorId: string | undefined, rendererId: string, message: unknown): Promise<boolean> {
        return this.rendererMessagingService.receiveMessage(editorId, rendererId, message);
    }

    dispose(): void {
        this.disposables.dispose();
    }
}
