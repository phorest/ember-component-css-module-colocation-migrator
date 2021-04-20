# ember-component-css-module-colocation-migrator

This codemod will co-locate CSS Modules for components alongside their JS and HBS counterparts.

The [ember-component-template-colocation-migrator](https://github.com/ember-codemods/ember-component-template-colocation-migrator) takes care of moving `.hbs` files to colocate them with their `.js` backing classes. For any Ember apps using the [ember-css-modules](https://github.com/salsify/ember-css-modules) addon, this leaves their application in a broken state: where `.js` and `.hbs` files are colocated, but their `.css` files are still stuck in `app/styles/components`. This codemod completes the job.

## Usage

To run the migrator on your app:

```sh
cd your/project/path
npx github:phorest/ember-component-css-module-colocation-migrator --module-prefix=my-ember-app
```

To find out what value to specify for `--module-prefix`, consult the `config/environment.js` file in your Ember app.

## Local Usage

```
node ./bin/ember-component-css-module-colocation-migrator.js --project-root=/your/project/path --module-prefix=my-ember-app
```

### Flat component structure

By default, the migrator changes the **classic** component structure to the **flat** component structure.

```
your-project-name
├── app
│   └── components
│       ├── foo-bar
│       │   ├── baz.css
│       │   ├── baz.hbs
│       │   └── baz.js
│       ├── foo-bar.css
│       ├── foo-bar.hbs
│       └── foo-bar.js
│   ...
```

### Nested component structure

If you want to change from **classic** to **nested**, you can specify the `--structure` option:

```sh
cd your/project/path
npx github:phorest/ember-component-css-module-colocation-migrator --structure=nested
```

The nested component structure looks like:

```
your-project-name
├── app
│   └── components
│       └── foo-bar
│           ├── baz
│           │   ├── index.css
│           │   ├── index.hbs
│           │   └── index.js
│           ├── index.css
│           ├── index.hbs
│           └── index.js
│   ...
```
