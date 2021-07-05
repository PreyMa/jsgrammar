const fs = require('fs');

const {Interpreter, Util}= require('./grammar.js');;
const {assert}= Util;

module.exports= function() {

  class Optional {
    constructor( v ) {
      this.data= v;
      this.filled= (typeof v !== 'undefined');
    }

    hasValue() {
      return this.filled;
    }

    value() {
      assert(this.hasValue(), 'Cannot get value from empty optional');
      return this.data;
    }

    valueOr( alt ) {
      return this.hasValue() ? this.data : alt;
    }

    valueOrUndefined() {
      return this.data;
    }

    asString() {
      const s= this.value();
      if( typeof s !== 'string' ) {
        throw Error('Value is not a string');
      }

      return s;
    }
  }

  class ConfigFile {
    constructor( path ) {
      this.file= null;
      if( path ) {
        this.load( path );
      }
    }

    load( path ) {
      try {
        this.file= JSON.parse( fs.readFileSync(path, 'utf8') );
      } catch( e ) {
        stop(`Could not load config file: '${path}'`);
      }

      if( !this.file || typeof this.file !== 'object' ) {
        stop('Empty config file');
      }
    }

    get( path ) {
      if( !this.file ) {
        return new Optional();
      }

      let cur= this.file;
      path.split('.').some( n => {
        cur= cur[n];
        return typeof cur === 'undefined';
      });

      return new Optional( cur );
    }

    getOrStop( path ) {
      const opt= this.get( path );
      if( !opt.hasValue() ) {
        stop(`Expected '${path}' field in the config file`)
      }

      return opt.value();
    }
  }

  class ArgumentParser {
    constructor() {
      this.argTypes= [];
    }

    defineArgument( config ) {
      this.argTypes.push( config )
    }

    _getConfigByName( name ) {
      let config= null;
      this.argTypes.some( c => {
        if( c.names.indexOf(name) >= 0 ) {
          config= c;
          return true;
        }
        return false;
      });

      return config;
    }

    parse( arr, off= 0 ) {
      for( let i= off; i!== arr.length; i++ ) {
        const arg= arr[i];

        const config= this._getConfigByName( arg );

        if( !config ) {
          stop(`Unknown option '${arg}'. Use --help`);
        }

        config.active= true;
        config.paramData= [];

        if( config.params ) {
          const num= config.params.length;
          config.paramData= arr.slice( i+1, i+ num+ 1 );
          i+= num;

          if( config.paramData.length !== num ) {
            stop(`Wrong number of arguments for option '${arg}'. Use --help`);
          }
        }
      }
    }

    get( name ) {
      const config= this._getConfigByName( name );
      assert( config, 'Unknwon option' );

      if( !config.active ) {
        return new Optional();
      }

      return new Optional( config.paramData );
    }

    _printOptionUsage( config ) {
      let params= '';
      if( config.params ) {
        config.params.forEach( p => params+= ` <${p}>` );
      }

      let str= '';
      config.names.forEach( (n, i, a) => str+= (n+ params+ (i < a.length-1 ? ', ' : '')) );

      return str;
    }

    printOptionList() {
      let maxLength= 0;
      const usageStrs= [];
      this.argTypes.forEach( config => {
        const u= this._printOptionUsage( config );
        usageStrs.push( u );
        maxLength= Math.max( maxLength, u.length );
      });

      let str= '';
      this.argTypes.forEach( (config, i) => {
        str+= '  '+ usageStrs[i].padEnd( 4+ maxLength );
        str+= config.desc+ '\n';
      });

      return str;
    }
  }

  // Fail with error message
  function stop( m= 'Unknown error' ) {
    console.error( 'Error:', m );
    process.exit(1);
  }

  // ANSI color escape codes
  const Colors= {
    Black:    s => `\x1b[30m${s}\x1b[0m`,
    Red:      s => `\x1b[31m${s}\x1b[0m`,
    Green:    s => `\x1b[32m${s}\x1b[0m`,
    Yellow:   s => `\x1b[33m${s}\x1b[0m`,
    Blue:     s => `\x1b[34m${s}\x1b[0m`,
    Magenta:  s => `\x1b[35m${s}\x1b[0m`,
    Cyan:     s => `\x1b[36m${s}\x1b[0m`,
    White:    s => `\x1b[37m${s}\x1b[0m`
  }

  const helpText=
`Simple EBNF matcher and text generator.

Usage:
  jsgrammar <option>

Available options:
`;

  // Setup the CLI arguments parser
  const args= new ArgumentParser();

  args.defineArgument({
    names: ['--help', '-h'],
    desc: 'Prints this message'
  });

  args.defineArgument({
    names: ['--config', '-c'],
    params: ['file'],
    desc: 'Either a json config file, or plain text file with ebnf rules'
  });

  args.defineArgument({
    names: ['--match', '-m'],
    params: ['rule', 'file'],
    desc: 'Tests if an input matches a grammar rule'
  });

  args.defineArgument({
    names: ['--generate', '-g'],
    params: ['rule', 'file'],
    desc: 'Generates random text based on a grammar rule'
  });

  args.defineArgument({
    names: ['--trim', '-t'],
    desc: 'Trim and reduce whitespace to single space characters in the input file'
  });

  args.defineArgument({
    names: ['--trimAll', '-ta'],
    desc: 'Remove all whitespace in the input file'
  })

  args.parse( process.argv, 2 );


  // Print help command
  if( args.get('--help').hasValue() ) {
    console.log( helpText+ args.printOptionList() );
    return;
  }

  let srcFilePath= null;

  // Load the config file and get the path to the grammar file from it
  const configFile= new ConfigFile();
  const [configFilePath]= args.get('--config').valueOr(['ebnf.json']);
  if( configFilePath.endsWith('.json') ) {
    configFile.load( configFilePath );

    srcFilePath= configFile.getOrStop('grammar');

  } else {
    srcFilePath= configFilePath;
  }

  // Load the grammar source file and create the interpreter
  let int= null;
  try {
    const srcFile= fs.readFileSync(srcFilePath, 'utf8');
    int= new Interpreter( configFile.get('generator').valueOrUndefined() );
    int.parse( srcFile );

  } catch( e ) {
    stop('Could not parse grammar file\n'+ e);
  }

  // Init the generator
  const generatorRulesConfig= configFile.get('generator.rules').valueOr({});
  for( const rule in generatorRulesConfig ) {
    int.setGeneratorConfig( rule, generatorRulesConfig[rule] );
  }


  // Match command
  const matchArgs= args.get('--match');
  if( matchArgs.hasValue() ) {
    const [ruleName, fileName]= matchArgs.value();

    try {
      let fileText= fs.readFileSync(fileName, 'utf8');

      // Trim whitespace and reduce whitespace between words to a single space char
      if( args.get('--trim').hasValue() ) {
        fileText= fileText.trim().replace(/\s+/g,' ');

      // Remove all whitespace
      } else if( args.get('--trimAll').hasValue() ) {
        fileText= fileText.replace(/\s/g,'');
      }

      if( int.match( ruleName, fileText) ) {
        console.log( Colors.Green('Successfull match') );
        return;
      }

      console.log( Colors.Red('Unsuccessfull match') );

      const err= int.matchError();
      console.log( err.hasError() ? err.toString() : 'Unknown error' );

    } catch( e ) {
      stop('Could not match file: '+ e);
    }
  }


  // Generate command
  const generatorArgs= args.get('--generate');
  if( generatorArgs.hasValue() ) {
    const [ruleName, fileName]= generatorArgs.value();

    try {
      const text= int.generate( ruleName );

      fs.writeFileSync( fileName, text, 'utf8' );

    } catch ( e ) {
      stop('Could not generate file: '+ e);
    }
  }
}
