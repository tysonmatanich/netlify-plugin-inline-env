const path = require("path");
const fs = require("fs");
const util = require("util");
const babel = require("@babel/core");
const inlineEnvironmentVariablesPlugin = require("@tysonmatanich/babel-plugin-transform-inline-environment-variables");
const writeFile = util.promisify(fs.writeFile);

const normalizeInputValue = (singleOrArrayValue) => {
  if (!singleOrArrayValue || Array.isArray(singleOrArrayValue)) {
    return singleOrArrayValue;
  }
  return [singleOrArrayValue];
};

const inlineEnvironmentVariables = async (
  file,
  include_vars,
  exclude_vars,
  verbose = false
) => {
  console.log("Processing:", verbose ? file.resolvedPath : file.path);

  // Perform the replacements
  const transformed = await babel.transformFileAsync(file.resolvedPath, {
    configFile: false,
    plugins: [
      babel.createConfigItem([
        inlineEnvironmentVariablesPlugin,
        { include: include_vars, exclude: exclude_vars },
      ]),
    ],
    retainLines: true,
  });

  // Get the replacements data from the metadata
  const replacements = transformed.metadata.keysReplaced;

  if (replacements.length > 0) {
    if (verbose) {
      console.group("Transformed code:");
      console.log(transformed.code);
      console.groupEnd();
    }

    // Save the file since replacements were performed
    await writeFile(file.resolvedPath, transformed.code, "utf8");
  }

  return replacements;
};

const processFiles = async ({ inputs, utils }) => {
  const verbose = !!inputs.verbose;

  const include_files = normalizeInputValue(inputs.include_files);

  if (!include_files.length) {
    utils.status.show({
      summary: "Skipped processing files because include_files was empty.",
    });
    return;
  }

  if (verbose) {
    console.log(
      "Build environment contains the following environment variables:",
      Object.keys(process.env)
    );
  }

  // Resolve paths
  const files = Array.from(
    new Set(
      include_files.map((filePath) => {
        const resolvedPath = path.resolve(process.cwd(), filePath);
        if (!fs.existsSync(resolvedPath)) {
          utils.build.failBuild(`File not found: ${resolvedPath}`);
        }
        return { path: filePath, resolvedPath };
      })
    )
  );

  if (files.length > 0) {
    let processedFiles = [];

    try {
      if (verbose) {
        console.log(
          "Attempting to process files:",
          files.map((file) => file.resolvedPath)
        );
      }

      const include_vars = normalizeInputValue(inputs.include_vars);
      const exclude_vars = normalizeInputValue(inputs.exclude_vars);

      if (verbose) {
        console.log("include_vars:", include_vars);
        console.log("exclude_vars:", exclude_vars);
      }

      // Process the files
      await Promise.all(
        files.map(async (file) => {
          const replacements = await inlineEnvironmentVariables(
            file,
            include_vars,
            exclude_vars,
            verbose
          );
          if (replacements.length > 0) {
            // File had replacements performed
            processedFiles.push({
              file,
              replacements,
            });
          }
        })
      );

      const uniqueReplacements = [
        ...new Set(processedFiles.flatMap((fileInfo) => fileInfo.replacements)),
      ];

      const singularPluralString = (items, singular, plural) => {
        return items.length === 1 ? singular : plural;
      };

      // Summarize processed files
      utils.status.show({
        summary: `Plugin processed \`${
          processedFiles.length
        }\` ${singularPluralString(processedFiles, "file", "files")} with \`${
          uniqueReplacements.length
        }\` environment ${singularPluralString(
          uniqueReplacements,
          "variable",
          "variables"
        )}:`,
        text: processedFiles
          .map(
            (fileInfo) =>
              `- ${
                verbose ? fileInfo.file.resolvedPath : fileInfo.file.path
              }\n${fileInfo.replacements
                .map((replacement) => `  - ${replacement}\n`)
                .join("")}`
          )
          .join(""),
      });
    } catch (err) {
      return utils.build.failBuild(
        `Failed to process files due to the following error:\n${err.message}`,
        { error: err }
      );
    }
  } else {
    utils.status.show({
      summary:
        "No environment variables were found in the files to be replaced.",
    });
  }
};

const handler = (inputs) => {
  return {
    [inputs.buildEvent || "onPreBuild"]: processFiles,
  };
};

handler.processFiles = processFiles;

module.exports = handler;
