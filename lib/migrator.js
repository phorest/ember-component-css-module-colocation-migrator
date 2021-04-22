const path = require('path');
const glob = require('glob');
const csstree = require('css-tree');
const { readFileSync, writeFileSync } = require('fs');
const {
  findDeclarationsUsingComposesFrom,
  generateReplacements,
  calculatePathsForFiles,
  unquoteString,
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
    const { appRoot, modulePrefix, appComponentsDir, appComponentStylesDir } = this;
    const cssFiles = this.findCssFiles();
    const manifest = calculatePathsForFiles(cssFiles, {
      appRoot,
      modulePrefix,
      appComponentsDir,
      appComponentStylesDir,
    });

    cssFiles.forEach((filePath) => {
      const module = convertAbsolutePathToModulePath({
        absolutePath: filePath,
        appRoot,
        modulePrefix,
      });
      const originalFileContents = readFileSync(filePath, { encoding: 'utf-8' });
      const ast = csstree.parse(originalFileContents);
      const targetNodes = findDeclarationsUsingComposesFrom(ast);
      const referencedModules = targetNodes.map((node) => {
        const {
          value: { children },
        } = node;
        const referencedModule = children.toArray().find((n) => {
          return n.type === 'String';
        });
        return unquoteString(referencedModule.value);
      });
      [...new Set(referencedModules)].forEach((referenced) => {
        manifest[referenced].referencedBy.push(module);
      });
    });

    writeFileSync(this.manifestFilepath, JSON.stringify(manifest, null, 2), { encoding: 'utf-8' });
  }

  cleanup() {
    // TODO:
    // * remove the JSON manifest file
    // * remove any empty directories left over in app/styles/components/
  }
}

module.exports = Migrator;
