const Migrator = require('./migrator');
const yargs = require('yargs/yargs')(process.argv.slice(2));

function main() {
  const args = yargs.env('CODEMOD').options({
    'module-prefix': { type: 'string', demandOption: true, default: 'my-app' },
    'project-root': { type: 'string', demandOption: false },
    structure: { type: 'string', choices: ['flat', 'nested'], default: 'flat' },
  }).argv;

  const { modulePrefix, projectRoot, structure } = args;
  const root = projectRoot || process.cwd();

  const migrator = new Migrator({ projectRoot: root, modulePrefix, structure });
  migrator.execute();
}

module.exports = main;
