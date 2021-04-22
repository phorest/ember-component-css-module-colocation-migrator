const path = require('path');
const csstree = require('css-tree');
const { resolve, dirname, extname } = require('path');

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
  doubleQuotePattern = /^"([^"]*)"$/;
  singleQuotePattern = /^'([^']*)'$/;

  if (doubleQuotePattern.test(original)) {
    return doubleQuotePattern.exec(original)[1];
  }

  if (singleQuotePattern.test(original)) {
    return singleQuotePattern.exec(original)[1];
  }

  return original;
}

// TODO: rename as 'normalisePath'
function explodeRelativePath({ modulePrefix, relativePath, sourceFilePath, appRoot }) {
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
          return explodeRelativePath({
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

module.exports = {
  explodeRelativePath,
  findDeclarationsUsingComposesFrom,
  generateReplacements,
  calculatePathsForFiles,
  unquoteString,
  convertAbsolutePathToModulePath,
};
