(function() {

  'use strict';

  const defaultEbnf= `
Sign ::= [-+]

Digit ::= [\\d]

Exp ::= ('e' | 'E').exponentChar Sign? Digit+.exponentDigits

Number ::= Sign? Digit+.intDigits ('.' Digit*.decimalDigits)? Exp?`;

  const defaultText= `+299792.458E3`;

  const defaultConfig= `
{
  "maxGenRepetition": 25,
  "rules": {
    "Number": {
      "intDigits": {},
      "decimalDigits": {}
    },
    "Exp": {
      "exponentChar": {},
      "exponentDigits": {
         "pow": "10"
      }
    }
  }
}`;

  const defaultRuleToMatch= 'Number';

  document.addEventListener('DOMContentLoaded', () => {

    const {Interpreter}= window.grammar;

    const ebnfTextField= document.getElementById('ebnf').firstElementChild;
    const textTextField= document.getElementById('text').firstElementChild;
    const configTextField= document.getElementById('config').firstElementChild;

    const generateCheckbox= document.getElementById('menu-generate');
    const autorunCheckbox= document.getElementById('menu-autorun');
    const traceCheckbox= document.getElementById('menu-trace');

    const trimSelector= document.getElementById('menu-trim');
    const runButton= document.getElementById('menu-run');
    const ruleText= document.getElementById('menu-rule');

    const output= document.getElementById('output');

    const ConsoleColor= {
      Red: { css: 'red' },
      Green: { css: 'green' }
    };

    function consoleClear() {
      output.innerHTML= '';
    }

    function consoleWriteLine( str, col= null ) {
      const line= document.createElement('div');

      if( col ) {
        line.classList.add( col.css );
      }

      line.innerText= str;

      output.appendChild( line );
    }

    function println( ...s ) {
      let col= s[s.length-1];
      if( col === ConsoleColor.Green || col === ConsoleColor.Red ) {
        s.pop();
      } else {
        col= null;
      }

       s.join(' ').split('\n').forEach( l => consoleWriteLine(l, col) );
    }

    function errorln( ...m ) {
      println( ...m, ConsoleColor.Red );
    }

    function debounce( tm, fn ) {
      let run= true;

      return function( ...a ) {
        if( run ) {
          run= false;
          setTimeout(() => run= true, tm );

          fn( ...a );
        }
      }
    }

    function update() {
      try {

        consoleClear();

        let text= textTextField.value;
        const ebnf= ebnfTextField.value;
        const configText= configTextField.value;

        if( !text ) {
          println('No input text')
          return;
        }

        // Parse JSON config
        let config;
        try {
          config= JSON.parse( configText ) || {};
        } catch( e ) {
          console.log( e );
          errorln('Invalid JSON syntax for the config', e);
          return;
        }

        // Create interpreter and parse the ebnf source
        config.createMatchTrace= traceCheckbox.checked;

        const int= new Interpreter( config );
        try {
          int.parse( ebnf );
        } catch( e ) {
          errorln('Parsing error');
          errorln( e );
          return;
        }

        // Run generator
        if( generateCheckbox.checked ) {
          // Init the generator
          const generatorRules= config.rules || {};
          for( const rule in generatorRules ) {
            int.setGeneratorConfig( rule, generatorRules[rule] );
          }

          try {
            const text= int.generate( ruleText.value );
            println( text );

          } catch( e ) {
            errorln('Text generation error');
            errorln( e );
            return;
          }

        // Run matcher
        } else {
          switch( trimSelector.value ) {
            case 'trim':
              text= text.trim().replace(/\s+/g,' ');
              break;

            case 'trimAll':
              text= text.replace(/\s/g,'');
              break;

            case 'disable':
            default:
              break;
          }

          try {
            const res= int.match( ruleText.value, text );
            if( traceCheckbox.checked ) {
              println( int.matchTrace().toString() );
            }

            if( res ) {
              println('Successfull match', ConsoleColor.Green);
              return;
            }

            const err= int.matchError();
            errorln( err.hasError() ? err.toString() : 'Unknown error' );

          } catch( e ) {
            errorln('Matching error');
            errorln( e );
            return;
          }
        }

      } catch( e ) {
        errorln('Caught internal error', e);
        console.error( e );
      }
    }

    // Setup default text values
    ebnfTextField.value= defaultEbnf;
    textTextField.value= defaultText;
    configTextField.value= defaultConfig;

    ruleText.value= defaultRuleToMatch;

    runButton.onclick= update;

    // Run continously on input
    ebnfTextField.oninput= textTextField.oninput= configTextField.oninput= debounce( 400, () => {
      if( autorunCheckbox.checked ) {
        update();
      }
    });

    // Run on Ctr+S
    document.addEventListener('keydown', e => {
      if( e.ctrlKey && e.key === 's' ) {
        e.preventDefault();

        update();
      }
    });

    // Run once
    update();
  });
})();
