const path = require('path');
const glob = require('glob');
const csstree = require('css-tree');
const { readFileSync, writeFileSync, existsSync, rmdirSync } = require('fs');
const { removeSync } = require('fs-extra');
const {
  findDeclarationsUsingComposesFrom,
  generateReplacements,
  calculatePathsForFiles,
  calculateReferencesForFiles,
  moveFile,
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

  get manifestFilepath() {
    return path.join(this.projectRoot, 'css-module-colocation.json');
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
    if (steps.includes(3)) {
      console.log('Running step 3: moving the CSS files');
      this.moveFiles();
    }
    if (steps.includes(4)) {
      console.log('Running step 4: updating "composes" references...');
      this.updateReferences();
    }
    if (steps.includes(5)) {
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
    const { appRoot, modulePrefix, appComponentsDir, appComponentStylesDir } = this;
    const cssFiles = this.findCssFiles();
    const manifest = calculatePathsForFiles(cssFiles, {
      appRoot,
      modulePrefix,
      appComponentsDir,
      appComponentStylesDir,
    });

    const fullManifest = calculateReferencesForFiles(cssFiles, {
      appRoot,
      modulePrefix,
      manifest,
    });

    writeFileSync(this.manifestFilepath, JSON.stringify(fullManifest, null, 2), {
      encoding: 'utf-8',
    });
  }

  moveFiles() {
    const manifestBuffer = readFileSync(this.manifestFilepath, { encoding: 'utf-8' });
    const manifest = JSON.parse(manifestBuffer);
    Object.values(manifest).forEach(({ shouldColocate, flat, nested, original }) => {
      if (shouldColocate) {
        const originalPath = original.diskPath;
        const newPath = this.structure === 'flat' ? flat.diskPath : nested.diskPath;
        moveFile(originalPath, newPath);
      }
    });
  }

  updateReferences() {
    const manifestBuffer = readFileSync(this.manifestFilepath, { encoding: 'utf-8' });
    const manifest = JSON.parse(manifestBuffer);
    for (const { flat, nested, original, referencedBy } of Object.values(manifest)) {
      const oldReference = original.modulePath;
      const newReference = this.structure === 'flat' ? flat.modulePath : nested.modulePath;
      referencedBy.forEach((moduleKey) => {
        // this module has a referrence that is currently pointing to the old location on disk
        const module = manifest[moduleKey];
        const moduleFilePath =
          this.structure === 'flat' ? module.flat.diskPath : module.nested.diskPath;
        const originalContents = readFileSync(moduleFilePath, { encoding: 'utf-8' });
        const updatedContents = originalContents.replace(
          new RegExp(`'${oldReference}'`, 'g'),
          `'${newReference}'`
        ).replace(
          new RegExp(`"${oldReference}"`, 'g'),
          `"${newReference}"`
        );
        writeFileSync(moduleFilePath, updatedContents, { encoding: 'utf-8' });
      });
    }
  }

  cleanup() {
    removeSync(this.manifestFilepath)
    if (existsSync(this.appComponentStylesDir)) {
      rmdirSync(this.appComponentStylesDir)
    }
  }
}

module.exports = Migrator;
