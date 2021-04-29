const fs = require('fs');
const path = require('path');
const csstree = require('css-tree');
const { resolve, dirname, extname } = require('path');
const { readFileSync } = require('fs');

function getFlatPathname({ absolutePath, appComponentsDir, appComponentStylesDir }) {
  return absolutePath.replace(appComponentStylesDir, appComponentsDir);
}

function getNestedPathname(params) {
  return getFlatPathname(params).replace(/.css$/, `${path.sep}index.css`);
}

function calculatePathsForFiles(
  cssFiles,
  { appRoot, modulePrefix, appComponentsDir, appComponentStylesDir }
) {
  const manifest = {};
  cssFiles.forEach((filePath) => {
    const shouldColocate = filePath.includes(appComponentStylesDir);

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
      referencedBy: [],
    };
  });
  return manifest;
}

function calculateReferencesForFiles(cssFiles, { appRoot, modulePrefix, manifest }) {
  const enhancedManifest = { ...manifest };
  cssFiles.forEach((filePath) => {
    const module = convertAbsolutePathToModulePath({
      absolutePath: filePath,
      appRoot,
      modulePrefix,
    });
    const originalFileContents = readFileSync(filePath, { encoding: 'utf-8' });
    const ast = csstree.parse(originalFileContents);
    const targetNodes = findDeclarationsUsingComposesFrom(ast);

    // For the current file, find any other modules that it references
    const referencedModules = targetNodes.map((node) => {
      const {
        value: { children },
      } = node;
      const referencedModule = children.toArray().find((n) => {
        return n.type === 'String';
      });
      return unquoteString(referencedModule.value);
    });

    // Convert to Set and back to an array to uniqify the list
    [...new Set(referencedModules)].forEach((referenced) => {
      enhancedManifest[referenced].referencedBy.push(module);
    });
  });
  return enhancedManifest;
}

function convertAbsolutePathToModulePath({
  absolutePath,
  appRoot,
  modulePrefix,
  includeExtension = false,
}) {
  const modulePath = absolutePath.replace(appRoot, modulePrefix);
  if (includeExtension) {
    return modulePath;
  } else {
    const extension = extname(absolutePath);
    return modulePath.replace(extension, '');
  }
}

function unquoteString(original) {
  const doubleQuotePattern = /^"([^"]*)"$/;
  const singleQuotePattern = /^'([^']*)'$/;

  if (doubleQuotePattern.test(original)) {
    return doubleQuotePattern.exec(original)[1];
  }

  if (singleQuotePattern.test(original)) {
    return singleQuotePattern.exec(original)[1];
  }

  return original;
}

function normalisePath({ modulePrefix, relativePath, sourceFilePath, appRoot }) {
  const unquotedRelativePath = unquoteString(relativePath);
  if (unquotedRelativePath.indexOf(modulePrefix) === 0) {
    return relativePath.replace(/\.css/, '');
  }
  const absolutePath = resolve(dirname(sourceFilePath), unquotedRelativePath);
  if (!absolutePath.includes(appRoot)) {
    throw new Error(`Bad input!\n${JSON.stringify(arguments, null, 2)}`);
  }
  const modulePath = convertAbsolutePathToModulePath({ absolutePath, appRoot, modulePrefix });
  return `'${modulePath}'`;
}

function findDeclarationsUsingComposesFrom(ast) {
  return csstree.findAll(ast, function (node) {
    const { type, property, value } = node;
    if (type === 'Declaration' && property === 'composes') {
      const { children } = value;
      const hasFrom = children.some(({ type, name }) => {
        return type === 'Identifier' && name === 'from';
      });
      return hasFrom;
    }
  });
}

function generateReplacements({ targetNodes, modulePrefix, appRoot, filePath }) {
  return targetNodes.map((node) => {
    const {
      value: { children },
    } = node;

    const original = children
      .map(({ type, value, name }) => {
        if (type === 'Identifier') {
          return name;
        }
        return value;
      })
      .toArray()
      .join('');

    const modified = children
      .map(({ type, value, name }) => {
        if (type === 'String') {
          return normalisePath({
            modulePrefix,
            appRoot,
            relativePath: value,
            sourceFilePath: filePath,
          });
        }
        if (type === 'Identifier') {
          return name;
        }
        return value;
      })
      .toArray()
      .join('');

    return { original, modified };
  });
}

function moveFile(sourceFilePath, targetFilePath) {
  let targetFileDirectory = path.dirname(targetFilePath);
  if (!fs.existsSync(targetFileDirectory)) {
    console.info(`📁 Creating ${targetFileDirectory}`);
    fs.mkdirSync(targetFileDirectory, { recursive: true });
  }

  console.info(`👍 Moving ${sourceFilePath} -> ${targetFilePath}`);
  fs.renameSync(sourceFilePath, targetFilePath);
}

module.exports = {
  normalisePath,
  findDeclarationsUsingComposesFrom,
  generateReplacements,
  calculatePathsForFiles,
  unquoteString,
  convertAbsolutePathToModulePath,
  calculateReferencesForFiles,
  moveFile,
};
