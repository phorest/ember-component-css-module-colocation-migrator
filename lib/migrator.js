const path = require('path');
const glob = require('glob');
const csstree = require('css-tree');
const { readFileSync, writeFileSync } = require('fs');
const { findDeclarationsUsingComposesFrom, generateReplacements } = require('./utils');

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
      console.log('Running step 2');
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
}

module.exports = Migrator;