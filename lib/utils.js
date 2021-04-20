const csstree = require('css-tree');
const { resolve, dirname } = require('path');

function explodeRelativePath({ modulePrefix, relativePath, sourceFilePath, appRoot }) {
  const unquotedRelativePath = relativePath.replace(/"/g, '').replace(/'/g, '');
  if (unquotedRelativePath.indexOf(modulePrefix) === 0) {
    return relativePath;
  }
  const absolutePath = resolve(dirname(sourceFilePath), unquotedRelativePath);
  if (!absolutePath.includes(appRoot)) {
    throw new Error(`Bad input!\n${JSON.stringify(arguments, null, 2)}`);
  }
  return `'${absolutePath.replace(appRoot, modulePrefix)}'`;
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

module.exports = { explodeRelativePath, findDeclarationsUsingComposesFrom, generateReplacements };
