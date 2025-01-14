# netlify-plugin-inline-env

[![npm version](https://badge.fury.io/js/netlify-plugin-inline-env.svg)](https://badge.fury.io/js/netlify-plugin-inline-env) [![UnitTest](https://github.com/tysonmatanich/netlify-plugin-inline-env/actions/workflows/unit-test.yml/badge.svg)](https://github.com/tysonmatanich/netlify-plugin-inline-env/actions/workflows/unit-test.yml)

Inline build time environment variable values into Netlify code (such as Netlify Functions) so that it becomes available at runtime.

## Why

When we talk about environment variable values for a Netlify Function, it is important to understand that there're two possible contexts:

**Build time**

This is when netlify builds your site. The following environment variables would be available at build time:

- Environment Variables you set at Netlify UI
- [Readonly Environment Variables](https://docs.netlify.com/configure-builds/environment-variables/#read-only-variables) set by Netlify including build/git metadata
- [Deploy Context Environment Variables](https://docs.netlify.com/configure-builds/file-based-configuration/#deploy-contexts) you set in `netlify.toml` within `[context.xxx.environment]` section
- Environment Variables set by other Netlify build plugins such as [contextual env plugin](https://github.com/cball/netlify-plugin-contextual-env#readme)

**Runtime**

This is when your Function code is evaluated when a request was received. The following environment variables would be available at runtime:

- Environment Variables you set at Netlify UI

**The Problem**

You may have noticed that the available environment variables at Runtime is only a subset of that in build time.

That is a common source of confusion for many people, see those discussions over [here](https://community.netlify.com/t/support-guide-using-environment-variables-on-netlify-correctly/267).

This plugin was built to mitigate this issue by inlining the build time environment variable values as part of your code, so that you can consider build time environment variables magically become available for runtime!

With the original Function source file

```
function handler(event, context) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      CONTEXT: process.env.CONTEXT
    })
  };
};

module.exports = { handler };
```

The plugin will produce the inlined Function source file

```
function handler(event, context) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      CONTEXT: "deploy-preview"    <---------- replaced with build time only env var values
    })
  };
};

module.exports = { handler };
```

**Caveats**

The plugin wouldn't replace more dynamic code like the following ones:

```
console.log(process.env);          <-------- no concrete values, won't be replaced with an object


const { CONTEXT } = process.env;   <-------- destructuring won't work! Please use process.env.CONTEXT instead (this also makes it more explicit and easier to search globally for process.env dependencies)


function getKey(key) {
  return process.env[key];         <-------- rely on runtime value so won't be replaced
}
```

So you may have to intentionlly convert the above code into something like `process.env.X` so it will be inlined.

## Install

<!-- You can install this plugin in the Netlify UI from this [direct in-app installation link](https://app.netlify.com/plugins/netlify-plugin-inline-env/install) or from the [Plugins directory](https://app.netlify.com/plugins). -->

For file-based installation, add the following lines to your `netlify.toml` file:

```toml
[[plugins]]
package = "netlify-plugin-inline-env"
```

To complete file-based installation, from your project's base directory, use npm, yarn, or any other Node.js package manager to add the plugin to `devDependencies` in `package.json`.

```bash
npm install -D netlify-plugin-inline-env
```

## More Options

### Debugging

You can turn on verbose for debugging purpose by providing plugin inputs.

```toml
[[plugins]]
package = "netlify-plugin-inline-env"
  [plugins.inputs]
  verbose = "true"
```

> Be careful with verbose mode, as it will print the files with the replaced env variables

### Configuring build event

If you are using TypeScript, or processing your code in other ways you may want to choose `onBuild`

```toml
[[plugins]]
package = "netlify-plugin-inline-env"
  [plugins.inputs]
  buildEvent = "onBuild"
```

Default value is `onPreBuild`. It's also been tested to work with `onBuild`
The values for buildEvent can be found [here](https://docs.netlify.com/configure-builds/build-plugins/create-plugins/#plug-in-to-build-events)

### Conditional Transformation

If you are using libraries such as [dotenv-defaults](https://github.com/mrsteele/dotenv-defaults), you may want to limit or skip the transformation for certain environment variables.

```toml
[[plugins]]
package = "netlify-plugin-inline-env"
  [plugins.inputs]
  exclude = ["DO_NOT_TRANSFORM_ME", "DO_NOT_TRANSFORM_ME_2"]
```

```toml
[[plugins]]
package = "netlify-plugin-inline-env"
  [plugins.inputs]
  include = ["ONLY_TRANSFORM_ME", "ONLY_TRANSFORM_ME_2"]
```

## Gotchas

1. The `[[plugins]]` line is required for each plugin, even if you have other plugins in your `netlify.toml` file already.

2. If you want to lock to a specific version (or a version that hasn't been accepted by netlify build system yet), please add `netlify-plugin-inline-env` to your dev dependencies by `yarn install --dev netlify-plugin-inline-env` or `npm install --save-dev netlify-plugin-inline-env`.
