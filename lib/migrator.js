const path = require('path');
const glob = require('glob');
const csstree = require('css-tree');
const { readFileSync, writeFileSync } = require('fs');
const {
  findDeclarationsUsingComposesFrom,
  generateReplacements,
  convertAbsolutePathToModulePath,
  getFlatPathname,
  getNestedPathname,
} = require('./utils');

class Migrator {
  constructor({ projectRoot, modulePrefix, structure }) {
    this.projectRoot = projectRoot;
    this.modulePrefix = modulePrefix;
    this.structure = structure;
  }

  get appRoot() {
    return path.join(this.projectRoot, 'app');
  }

  get appStylesDir() {
    return path.join(this.appRoot, 'styles');
  }

  get appComponentsDir() {
    return path.join(this.appRoot, 'components');
  }

  get appComponentStylesDir() {
    return path.join(this.appStylesDir, 'components');
  }

  findCssFiles() {
    return glob.sync(`${this.appStylesDir}/**/*.css`);
  }

  execute(steps) {
    if (steps.includes(1)) {
      console.log(
        `Exectue Step 1: rewrite "composes: class-name from './other-module'" to use module-prefixed paths`
      );
      this.explodeRelativeImports();
    }
    if (steps.includes(2)) {
      console.log('Running step 2: generate JSON manifest');
      this.generateManifest();
    }
    if (steps.includes(11)) {
      console.log('Final step: Cleaning up');
      this.cleanup();
    }
  }

  explodeRelativeImports() {
    this.findCssFiles().forEach((filePath) => {
      const { modulePrefix, appRoot } = this;
      const originalFileContents = readFileSync(filePath, { encoding: 'utf-8' });
      const ast = csstree.parse(originalFileContents);
      const targetNodes = findDeclarationsUsingComposesFrom(ast);
      const replacements = generateReplacements({ targetNodes, modulePrefix, appRoot, filePath });

      let updatedFileContents = originalFileContents;
      replacements.forEach(({ original, modified }) => {
        updatedFileContents = updatedFileContents.replace(original, modified);
      });

      writeFileSync(filePath, updatedFileContents, { encoding: 'utf-8' });
    });
  }

  generateManifest() {
    const { projectRoot, appRoot, modulePrefix, appComponentsDir, appComponentStylesDir } = this;
    const manifest = {};
    this.findCssFiles().forEach((filePath) => {
      const shouldColocate = filePath.includes(this.appComponentStylesDir);

      const originalModulePath = convertAbsolutePathToModulePath({
        absolutePath: filePath,
        appRoot,
        modulePrefix,
      });
      const original = { diskPath: filePath, modulePath: originalModulePath };

      const flatDiskPath = getFlatPathname({
        absolutePath: filePath,
        appComponentsDir,
        appComponentStylesDir,
      });
      const flatModulePath = convertAbsolutePathToModulePath({
        absolutePath: flatDiskPath,
        appRoot,
        modulePrefix,
        includeExtension: true,
      });

      const nestedDiskPath = getNestedPathname({
        absolutePath: filePath,
        appComponentsDir,
        appComponentStylesDir,
      });
      const nestedModulePath = convertAbsolutePathToModulePath({
        absolutePath: nestedDiskPath,
        appRoot,
        modulePrefix,
        includeExtension: true,
      });

      manifest[originalModulePath] = {
        shouldColocate,
        original,
        flat: shouldColocate ? { diskPath: flatDiskPath, modulePath: flatModulePath } : original,
        nested: shouldColocate
          ? { diskPath: nestedDiskPath, modulePath: nestedModulePath }
          : original,
      };
    });

    const manifestFilepath = path.join(projectRoot, 'css-module-colocation.json');
    writeFileSync(manifestFilepath, JSON.stringify(manifest, null, 2), { encoding: 'utf-8' });
  }

  cleanup() {
    // TODO:
    // * remove the JSON manifest file
    // * remove any empty directories left over in app/styles/components/
  }
}

module.exports = Migrator;
