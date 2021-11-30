const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;
const yargs = require('yargs/yargs');
const Watcher = require('./watcher');

class Client {
  name;
  yargs;

  static messages = {
    NO_INPUT_PATH: 'Error: no input path specified',
    EXTRA_OUTPUT_PATH: 'Error: only one output file is allowed',
    EXTRA_ROOT_DIR: 'Error: only one root dir is allowed',
    EXTRA_COMMAND: 'Error: only one command is allowed',
  };

  constructor(name) {
    this.name = name || '$0';
    this.initArgs();
    this.parseArgs();
    this.initWatcher();
  }

  initArgs = () => {
    this.yargs = yargs(process.argv.slice(2))
      .usage('Usage: ' + this.name + ' <input> [options]')
      .command('$0 [input]', false)
      .option('c', {
        alias: 'command',
        describe: 'Pass a command to execute; Shell syntax allowed',
        type: 'string',
        requiresArg: true,
      })
      .option('o', {
        alias: 'output',
        describe: 'Output CSS file path',
        type: 'string',
        requiresArg: true,
      })
      .option('r', {
        alias: 'root-dir',
        describe: 'Directory to watch for addition/deletion of the files',
        type: 'string',
        default: process.cwd(),
        requiresArg: true,
      })
      .option('I', {
        alias: 'include-path',
        describe: 'Path to look for imported files; use multiple if needed',
        type: 'string',
        requiresArg: true,
      })
      .option('e', {
        alias: 'include-extensions',
        describe: 'File extensions to watch',
        type: 'array',
        default: Watcher.defaultExtensions,
      })
      .option('v', {
        alias: 'verbose',
        describe: 'Verbosity level',
        type: 'count',
      })
      .help()
      .alias('h', 'help')
      .version()
      .alias('V', 'version')
      .wrap(null)
      .strict();
  };

  parseArgs = () => {
    const argv = this.yargs.argv;

    if (process.argv.length === 2) {
      this.yargs.showHelp();
      process.exit(1);
    }

    if (!argv.input || argv.input.length === 0) {
      console.error(Client.messages.NO_INPUT_PATH);
      process.exit(1);
    }

    this.inputPath = path.resolve(argv.input);
    this.outputPath = argv.output;

    if (this.outputPath instanceof Array) {
      console.error(Client.messages.EXTRA_OUTPUT_PATH);
      process.exit(1);
    }

    if (this.outputPath) {
      this.outputPath = path.resolve(this.outputPath);
    }

    this.includePaths = argv.includePath ? [].concat(argv.includePath) : [];

    if (process.env.SASS_PATH) {
      this.includePaths = this.includePaths.concat(
        process.env.SASS_PATH.split(/:/).map((f) => path.resolve(f)),
      );
    }

    this.includePaths = this.includePaths.map((includePath) =>
      path.resolve(includePath),
    );

    this.includeExtensions = argv.includeExtensions;
    this.rootDir = argv.rootDir;

    if (this.rootDir instanceof Array) {
      console.error(Client.messages.EXTRA_ROOT_DIR);
      process.exit(1);
    }

    if (this.rootDir) {
      this.rootDir = path.resolve(this.rootDir);
    }

    this.verbosity = argv.verbose;
    this.command = argv.command;

    if (this.command instanceof Array) {
      console.error(Client.messages.EXTRA_COMMAND);
      process.exit(1);
    }
  };

  initWatcher = () => {
    this.watcher = new Watcher(this.inputPath, {
      rootDir: this.rootDir,
      includePaths: this.includePaths,
      includeExtensions: this.includeExtensions,
      verbosity: this.verbosity,
    });

    this.watcher.on('init', this.processUpdate.bind(this));
    this.watcher.on('update', this.processUpdate.bind(this));
  };

  processUpdate = () => {
    if (this.command) {
      this.processCommand();
    } else {
      this.processOutput();
    }

    if (this.verbosity === 1) {
      process.stderr.write('.');
    }
  };

  processCommand = () => {
    const inputPath = this.inputPath;
    const outputPath = this.outputPath;
    let command = this.command.replace('<input>', inputPath);

    if (outputPath) {
      command = command.replace('<output>', outputPath);
    }

    const subprocess = exec(command, (err, stdout, stderr) => {
      if (stderr) {
        console.error(stderr);
      }

      if (err) {
        console.error(
          'Error: command "%s" exited with exit code %d',
          command,
          err.code,
        );
        return;
      }

      if (stdout) {
        this.output(stdout);
      }
    });

    fs.createReadStream(inputPath).pipe(subprocess.stdin);
  };

  processCommand = () => {
    const inputPath = this.inputPath;
    const outputPath = this.outputPath;
    let command = this.command.replace('<input>', inputPath);

    if (outputPath) {
      command = command.replace('<output>', outputPath);
    }

    const subprocess = exec(command, (err, stdout, stderr) => {
      if (stderr) {
        console.error(stderr);
      }

      if (err) {
        console.error(
          'Error: command "%s" exited with exit code %d',
          command,
          err.code,
        );
        return;
      }

      if (stdout) {
        this.output(stdout);
      }
    });

    fs.createReadStream(inputPath).pipe(subprocess.stdin);
  };

  processOutput = () => {
    fs.readFile(this.inputPath, (err, data) => {
      if (err) {
        throw err;
      }

      this.output(data.toString());
    });
  };

  output = (data) => {
    const outputPath = this.outputPath;

    if (outputPath) {
      fs.writeFileSync(outputPath, data);
    } else {
      process.stdout.write(data);
    }
  };

  run = () => {
    this.watcher.run();
  };
}

module.exports = Client;
