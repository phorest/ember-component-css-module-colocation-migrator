const path = require('path');
const glob = require('glob');
const csstree = require('css-tree');
const { readFileSync, writeFileSync } = require('fs');
const {
  findDeclarationsUsingComposesFrom,
  generateReplacements,
  convertAbsolutePathToModulePath,
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
    const { appRoot, modulePrefix } = this;
    const manifest = {};
    this.findCssFiles().forEach((filePath) => {
      // key: module-prefixed path for CURRENT location on disk
      // has-component: Boolean
      // flat: { diskpath: '', modulepath: '.css' }
      // nested: { diskpath: '', modulepath: '.css' }
      const key = convertAbsolutePathToModulePath({
        absolutePath: filePath,
        appRoot,
        modulePrefix,
      });
      manifest[key] = { hasComponent: false };
    });
    console.log(manifest);
  }

  cleanup() {
    // TODO:
    // * remove the JSON manifest file
    // * remove any empty directories left over in app/styles/components/
  }
}

module.exports = Migrator;
