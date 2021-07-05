#! /usr/bin/env node

// If required as module
if( require.main !== module ) {
  module.exports= require('./grammar.js');;
  return;
}


// CLI application
require('./cli.js')();
