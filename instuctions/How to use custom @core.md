To use your own version of `@theia/core` in your package dependencies, you need to follow these steps:

1. **Clone the Theia repository:**
   First, clone the Theia repository if you haven't already done so. You can clone it using the following command:

   ```bash
   git clone https://github.com/eclipse-theia/theia.git
   cd theia
   ```

2. **Make your changes:**
   Make the necessary changes to the `@theia/core` package or any other Theia packages.

3. **Build your custom `@theia/core`:**
   Build the `@theia/core` package to generate the necessary artifacts. You can do this by running the following commands:

   ```bash
   cd packages/core
   yarn install
   yarn build
   ```

4. **Publish your custom `@theia/core` (optional):**
   If you want to publish your custom version of `@theia/core` to a package registry (like npm), you can do so. However, for local testing and development, you can skip this step and use a local path instead.

5. **Use the custom `@theia/core` in your project:**
   In your own project, you need to add a dependency to your custom `@theia/core`. You can do this by using a local path or a custom registry. For a local path, modify your `package.json` to point to the local build of `@theia/core`:

   ```json
   {
     "dependencies": {
       "@theia/core": "file:../path/to/theia/packages/core"
     }
   }
   ```

   Make sure to replace `../path/to/theia/packages/core` with the actual relative path to the `@theia/core` package.

6. **Install dependencies:**
   Run `yarn install` or `npm install` in your project to install the dependencies, including your custom `@theia/core`.

7. **Build your project:**
   Finally, build your project as usual. Your project should now use the custom version of `@theia/core`.

### Example

Assuming your project structure is as follows:

```
/my-theia-project
  /packages
    /core (custom @theia/core)
  /your-project (your project that depends on @theia/core)
```

In the `your-project/package.json`:

```json
{
  "dependencies": {
    "@theia/core": "file:../packages/core"
  }
}
```

Then, in `your-project`, run:

```bash
cd your-project
yarn install
yarn build
```

This setup ensures that your project uses the custom version of `@theia/core` that you have modified and built locally.