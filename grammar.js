(function() {

  'use strict';

  function abstractMethod() {
    throw Error('Abstract Method')
  }

  function checkSingleChar( s ) {
    if( s.length !== 1 ) {
      throw Error('Expected character');
    }
  }

  function isWhitespace( s ) {
    checkSingleChar( s );
    return /\s/.test(s);
  }

  function isWordChar( s ) {
    checkSingleChar( s );
    return /\w/.test( s );
  }

  function isAlphaChar( s ) {
    checkSingleChar( s );
    return /[_A-Za-z]/.test( s );
  }

  function isOperator( s ) {
    checkSingleChar( s );
    return /[\*\+\?\|\{\[\"\'\(\)]/.test( s );
  }

  function unwrapMessageCb( m, ...a ) {
    return (m instanceof Function) ? m( ...a ) : m;
  }

  function assert( x, m= '' ) {
    if( !x ) {
      // Construct long/labour intensive messages via callback
      throw Error( 'Assertion failed: '+ unwrapMessageCb( m, x ) );
    }
  }


  /**
  * Range Distribution class
  * Select a random value from a list based on its weight. Heavy values are
  * selected more likely as they make up a larger percentages of the summed weights
  **/
  class RangeDistribution {
    constructor( arr, fn ) {
      /** @type {[any]} **/
      this.dataList= arr;

      /** @type {[number]} **/
      this.rangeList= [];

      function checkWeight( w ) {
        assert( w >= 0, 'Weight has to be greater than or equal to zero' );
        return w;
      }

      // Sum up all weights
      /** @type {number} **/
      this.rangeSum= this.dataList.reduce( (a, d, i) => a+ checkWeight( fn(d, i ) ), 0 );
      if( !this.rangeSum ) {
        this.rangeList= null;
        return;
      }

      // Create list of weight percentages from 0 to 1
      // The heavier a data element, the large the span is it takes up
      let accu= 0;
      this.dataList.forEach( (c, i) => this.rangeList.push(accu += ( checkWeight( fn(c, i) ) / this.rangeSum)) );
      this.rangeList[ this.rangeList.length -1 ]= 1;
    }

    random() {
      if( !this.rangeList ) {
        return undefined;
      }

      const r= Math.random();

      let fnd= null;
      const res= this.rangeList.some( (threshold, i) => {
        if( r <= threshold ) {
          fnd= this.dataList[i];
          return true;
        }

        return null;
      });

      assert( res, () => 'No element in range distribution found: '+ r+ ' ['+ this.rangeList.join()+ ']' );

      return fnd;
    }
  }


  /**
  * Abstract Char Class class
  * Base class for Range Char Class and Fragmented Char Class
  * Creates a single random character or checks whether a character is part of
  * the class
  **/
  class CharClass {
    constructor() {}

    length() {
      abstractMethod();
    }

    contains() {
      abstractMethod();
    }

    generateSingle() {
      abstractMethod();
    }
  }

  /*
  * Range Char Class class
  * Defines a range of a characters inbetween two code points
  */
  class RangeCharClass extends CharClass {
    /**
    * @param {String} s
    * @param {String} e
    **/
    constructor( s, e ) {
      super();

      checkSingleChar( s );
      checkSingleChar( e );

      this.startChar= s;
      this.endChar= e;

      this.startCharCode= s.charCodeAt( 0 );
      this.endCharCode= e.charCodeAt( 0 );

      assert( this.startCharCode <= this.endCharCode, () => `Range out of order in character class: '${this.startChar}-${this.endChar}'` );
    }

    length() {
      return this.endCharCode- this.startCharCode;
    }

    contains( s ) {
      const code= s.charCodeAt(0);
      return (this.startCharCode<= code) && (code<= this.endCharCode);
    }

    generateSingle() {
      const diff= this.endCharCode- this.startCharCode;
      return String.fromCharCode( Math.round( this.startCharCode+ diff* Math.random() ) );
    }
  }

  RangeCharClass.Digit=      new RangeCharClass('0', '9');
  RangeCharClass.AlphaUpper= new RangeCharClass('A', 'Z');
  RangeCharClass.AlphaLower= new RangeCharClass('a', 'z');

  /*
  * Fragmented Char Class class
  * Defines a list of characters
  */
  class FragmentedCharClass extends CharClass {
    /** @param {String} s **/
    constructor( s ) {
      super();

      this.chars= s;
    }

    length() {
      return this.chars.length;
    }

    contains( s ) {
      return this.chars.indexOf( s ) !== -1;
    }

    generateSingle() {Math.random();
      return this.chars.charAt( Math.round( (this.chars.length-1)* Math.random() ) );
    }
  }


  FragmentedCharClass.WhiteSpace= new FragmentedCharClass(' \f\n\r\t\v');
  FragmentedCharClass.Specials  = new FragmentedCharClass('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~');


  /**
  * String Builder class
  * Converts inputs into an array of strings that is joined at the end
  **/
  class StringBuilder {
    constructor() {
      this.arr= [];
    }

    append( ...strs ) {
      strs.forEach( s => this.arr.push( s+ '' ) );
    }

    toString() {
      return this.arr.join('');
    }
  }


  /**
  * String Consumer class
  * Consumes one of many strings from a specified list and calls an attached callback
  * function. Uses a tree of string snippets to do as little work as possible. Overlapping
  * strings like 'hello' and 'helloworld' result in bad behaviour.
  **/
  class StringConsumer {
    constructor( config ) {

      this.stringLengthSymbol= Symbol('StringLength');
      this.tree= this._buildTree( config );
    }

    _buildTree( config ) {
      const stage= {}, next= {};
      let minLength= Number.MAX_SAFE_INTEGER;

      // Find shortest string segment to consume
      for( const key in config ) {
        minLength= Math.min( minLength, key.length );
      }

      stage[this.stringLengthSymbol]= minLength;

      // Add the first half of the string to current stage and save the rest for the
      // next stage
      for( const key in config ) {
        const head= key.substring(0, minLength);
        const tail= key.substring(minLength);

        if( tail.length ) {
          if( !next[head] ) {
            next[head]= {};
          }

          next[head][tail]= config[key];

        // The whole string can be added
        } else {
          const fn= config[key];
          assert( typeof fn === 'function', 'Expected callback function for StringConsumer');

          stage[head]= fn;
        }
      }

      // Create subtrees
      for( const key in next ) {
        stage[key]= this._buildTree( next[key] );
      }

      return stage;
    }

    /** @param {StringIterator} it **/
    consume( it, ...args ) {
      let lenAccu= 0;

      let stage= this.tree;
      while( stage ) {
        const len= stage[this.stringLengthSymbol];
        const str= it.get( len, lenAccu );
        const val= stage[str];

        lenAccu+= len;

        if( typeof val === 'function' ) {
          it.jumpBy( lenAccu );
          return val( it, ...args );
        }

        stage= val;
      }

      return null;
    }
  }

  /**
  * String Position class
  * Stores index, line number and line-column of a position in a string
  **/
  class StringPosition {
    constructor( p= null ) {
      /** @type {number} **/
      this.idx= 0;
      /** @type {number} **/
      this.line= 0;
      /** @type {number} **/
      this.col= 0;


      if( p instanceof StringPosition ) {
        this.idx= p.idx;
        this.line= p.line;
        this.col= p.col;
      }
    }

    index() {
      return this.idx;
    }

    toString() {
      return `${this.line+1}:${this.col+1}`;
    }
  }


  /**
  * String Iterator class
  * Iterates though a string's characters. Allows for peaking, jumping and string
  * splitting.
  **/
  class StringIterator extends StringPosition {
    /** @param {String|StringIterator} s **/
    constructor( s ) {
      super( s );

      /** @type {String} **/
      this.str= null;

      if( s instanceof StringIterator ) {
        this.str= s.str;
        return;
      }

      // Set the position before the first char
      this.str= s;
      this.idx= -1;
      this.col= -1;
    }

    hasNext() {
      return this.idx < this.str.length;
    }

    next() {
      if( !this.hasNext() ) {
        throw Error('String Iterator bound check');
      }

      this.col++;
      if( this.get() === '\n' ) {
        this.line++;
        this.col= 0;
      }

      this.idx++;
      return this.get();
    }

    get( len= 1, off= 0 ) {
      if( len === 1 ) {
        return this.str.charAt( this.idx+ off );
      }

      return this.str.substr( this.idx+ off, len );
    }

    /** @param {number|StringPosition} pos **/
    set( pos ) {
      if( pos instanceof StringPosition ) {
        this.idx= pos.idx;
        this.col= pos.col;
        this.line= pos.line;

        assert((this.idx >= 0) && (this.idx <= this.str.length), 'Invalid seek position');

      } else {
        this._jumpToPos( pos );
      }
    }

    peak( len= 1 ) {
      if( !this.hasNext() ) {
        return null;
      }

      return this.get( len, 1 );
    }

    is( s ) {
      return this.str.startsWith(s, this.idx);
    }

    consume( s ) {
      if( this.is( s ) ) {
        this._jumpToPos( this.idx+ s.length );
        return true;
      }

      return false;
    }

    /** @param {number} pos **/
    _jumpToPos( pos ) {
      assert( (pos >= 0) && (pos <= this.str.length), 'Invalid seek position' );

      // Nop
      if( pos === this.idx ) {
        return;
      }

      // Move forward
      if( pos > this.idx ) {
        let line= this.line;
        let prev= this.idx;
        let cur= this.str.indexOf('\n', this.idx);
        cur= cur < 0 ? this.str.length : cur;

        // Move forward until the position is reached or skipped
        while( cur < pos ) {
          // Store the beginnig of the last line
          prev= cur;
          cur= this.str.indexOf('\n', cur+1);
          cur= cur < 0 ? this.str.length : cur;

          line++;
        }

        this.col= (line === this.line) ? this.col + (pos- this.idx) : pos- prev- 1;
        this.line= line;

      // Move backwards
      } else {
        let line= this.line;
        let cur= this.str.lastIndexOf('\n', this.idx-1);

        // Move backwards until the position is reached or skipped
        while( cur > pos ) {
          cur= this.str.lastIndexOf('\n', cur-1);
          line--;
        }

        // The reached position is the end of the line, find it's beginning
        if( cur === pos ) {
          cur= this.str.lastIndexOf('\n', cur-1);
          line--;
        }

        this.col= (line === this.line) ? this.col - (this.idx- pos) : pos- cur-1;
        this.line= line;
      }

      this.idx= pos;
    }

    jumpTo( s ) {
      const pos= this.str.indexOf( s, this.idx );
      this._jumpToPos( pos < 0 ? this.str.length : pos+ s.length );
    }

    jumpWhile( fn ) {
      while( this.hasNext() && fn(this.get()) ) {
        this.next();
      }
    }

    jumpBy( off ) {
      const pos= Math.min( Math.max( this.idx+ off, 0 ), this.str.length );
      this._jumpToPos( pos  );
    }

    position() {
      return new StringPosition( this );
    }

    substring( pos, off= 0 ) {
      if( pos instanceof StringIterator ) {
        pos= pos.idx;
      }

      const b= Math.min( pos, this.idx+ off );
      const e= Math.max( pos, this.idx+ off );

      return this.str.substring( b, e );
    }

    splitString() {
      return this.substring( this, this.str.length- this.idx );
    }

    copy() {
      return new StringIterator( this );
    }
  }


  const StringEscapeTable= {
    'b': '\b',
    'f': '\f',
    'n': '\n',
    'r': '\r',
    't': '\t',
    'v': '\v',
    '0': '\0'
  };

  /**
  * Token Iterator class
  * Lexes EBNF source files and returns tokens. Jumps over comments and allows
  * for peaking.
  **/
  class TokenIterator {
    constructor( s ) {
      this.it= new StringIterator( s );
      this.it.next();

      this.peakToken= null;
    }

    hasNext() {
      return this.it.hasNext() || ( this.peakToken && !this.peakToken.is(Token.None) );
    }

    next() {
      if( this.peakToken ) {
        const t= this.peakToken;
        this.peakToken= null;
        return t;
      }

      return this._readNext();
    }

    peak() {
      if( !this.peakToken ) {
        this.peakToken= this._readNext();
      }

      return this.peakToken;
    }

    _readNext() {
      this._ignoreCommentsAndWhitespace();

      if( !this.hasNext() ) {
        return new Token( Token.None, this.it.position() );
      }

      let token= null;
      if( isAlphaChar(this.it.get()) ) {
        token= this._readName();

      } else if( this.it.is('"') || this.it.is("'") ) {
        token= this._readString();

      } else if( this.it.is('[') ) {
        token= this._readCharClass();

      } else if( this.it.is('{') ) {
        token= this._readQuantifier();

      } else {
        token= this._readOperator();

        if( !token ) {
          token= this._readFreeString();
        }
      }

      this._ignoreCommentsAndWhitespace();

      return token;
    }

    _jumpWhiteSpace() {
      this.it.jumpWhile( isWhitespace );
    }

    _ignoreCommentsAndWhitespace() {
      this._jumpWhiteSpace();
      this._readComment();
      this._jumpWhiteSpace();
    }

    _readName() {
      const start= this.it.index();

      this.it.jumpWhile( isWordChar );

      return new Token( Token.Name, this.it.position(), this.it.substring( start ) );
    }

    _readString() {
      const stopChar= this.it.get();

      let str= '';
      while( this.it.hasNext() ) {
        const char= this.it.next();

        if( char === '\\' ) {
          if( !this.it.hasNext() ) {
            throw Error('Unexpected end of string');
          }

          const seq= this.it.next();
          const esc= StringEscapeTable[seq];

          str+= (typeof esc === 'string') ? esc : seq;
          continue;
        }

        if( char === stopChar ) {
          this.it.next();
          return new Token( Token.String, this.it.position(), str );
        }

        str+= char;
      }

      throw Error('Unexpected end of string');
    }

    _readFreeString() {
      const start= this.it.index();

      this.it.jumpWhile( c => !isWhitespace(c) && !isOperator(c) );

      return new Token( Token.String, this.it.position(), this.it.substring( start ) );
    }

    _readCharClass() {
      const start= this.it.index();

      while( this.it.hasNext() ) {
        const char= this.it.next();

        if( char === '\\' ) {
          this.it.next();
          continue;
        }

        if( char === ']' ) {
          this.it.next();
          return new Token( Token.CharClass, this.it.position(), this.it.substring( start ) );
        }
      }

      throw Error('Unexpected end of character class');
    }

    _readQuantifier() {
      const start= this.it.index();

      this.it.jumpTo('}');

      return new Token( Token.Repeat, this.it.position(), this._readQuantifierName(), this.it.substring(start) );
    }

    _readOperator() {
      return TokenIterator.operatorConsumer.consume( this.it, this );
    }

    _readQuantifierName() {
      if( this.it.consume('.') ) {
        const start= this.it.index();

        this.it.jumpWhile( isWordChar );

        const str= this.it.substring( start );
        assert( str.length, `Expected quantifier name '.'`);

        return str;
      }

      return '';
    }

    _readComment() {
      if( this.it.consume('//') ) {
        this.it.jumpTo('\n');

      } else if( this.it.consume('/*') ) {
        this.it.jumpTo('*/');
      }
    }
  }

  TokenIterator.operatorConsumer= new StringConsumer({
    '::=': (it, self) => new Token( Token.Define,       it.position() ),
    '?':   (it, self) => new Token( Token.Optional,     it.position(), self._readQuantifierName() ),
    '+':   (it, self) => new Token( Token.MinOne,       it.position(), self._readQuantifierName() ),
    '*':   (it, self) => new Token( Token.RepeatMany,   it.position(), self._readQuantifierName() ),
    '|':   (it, self) => new Token( Token.Or,           it.position() ),
    '(':   (it, self) => new Token( Token.ExpStart,     it.position() ),
    ')':   (it, self) => new Token( Token.ExpEnd,       it.position(), self._readQuantifierName() ),
    '&':   (it, self) => new Token( Token.PosLookAhead, it.position() ),
    '!':   (it, self) => new Token( Token.NegLookAhead, it.position() ),
    '~':   (it, self) => new Token( Token.Cut,          it.position() )
  });

  /**
  * Token Base class
  * Implements basic type checks and error reporting.
  **/
  class Token {
    /** @param {StringPosition} pos **/
    constructor( t= Token.None, pos= null, s= null, d= null) {
      /** @type {String} **/
      this.str= s;
      this.type= t;
      this.pos= pos || new StringPosition();
      this.optData= d;
    }

    is( ...t ) {
      if( t.length === 1 ) {
        return this.type === t[0];
      }

      return t.some( x => this.type === x );
    }

    data() {
      return this.str;
    }

    optionalData() {
      return this.optData;
    }

    position() {
      return this.pos;
    }

    isQuantifier() {
      return [ Token.MinOne, Token.Optional, Token.Repeat, Token.RepeatMany ].indexOf( this.type ) !== -1;
    }

    toString() {
      if( this.str || this.optData ) {
        return `${this.type.name}: '${this.str || this.optData}'`;
      }

      return this.type.name;
    }

    throwError( msg ) {
      throw Error(`Error at line ${this.pos.toString()}: ${this.toString()}: ${msg}`);
    }
  }

  Token.None=         { id: 0,  name: 'None' };
  Token.String=       { id: 1,  name: 'String' };
  Token.Name=         { id: 2,  name: 'Name' };
  Token.CharClass=    { id: 3,  name: 'CharClass' };
  Token.Or=           { id: 4,  name: 'Or' };
  Token.MinOne=       { id: 5,  name: 'MinOne' };
  Token.Optional=     { id: 6,  name: 'Optional' };
  Token.Repeat=       { id: 7,  name: 'Repeat' };
  Token.RepeatMany=   { id: 8,  name: 'RepeatMany' };
  Token.Define=       { id: 9,  name: 'Define' };
  Token.ExpStart=     { id: 10, name: 'ExpStart' };
  Token.ExpEnd=       { id: 11, name: 'ExpEnd' };
  Token.NegLookAhead= { id: 12, name: 'NegLookAhead' };
  Token.PosLookAhead= { id: 13, name: 'PosLookAhead' };
  Token.Cut=          { id: 14, name: 'Cut' };


  /**
  * Match Error class
  * Contains a backtrace of the recursive expressions when a matching error occurs.
  * Every grammar node appends itself to the trace on error.
  **/
  class MatchError {
    constructor() {
      this.backtrace= [];
    }

    error( n, pos, m ) {
      this.clear();
      this.append( n, pos, m );
    }

    append( node, pos, msg= null ) {
      this.backtrace.push({ node, pos, msg });
    }

    hasError() {
      return this.backtrace.length !== 0;
    }

    toString() {
      if( !this.hasError() ) {
        throw Error('Match error is empty');
      }

      let str= 'Matching Error: \n';
      this.backtrace.forEach( entry => {
        const errStr= entry.node.matchErrorString();
        if( errStr ) {
          str+= `at line ${entry.pos.toString()}: ${errStr} ${entry.msg || ''}\n`;
        }
      });

      return str;
    }

    clear() {
      this.iterator= null;
      this.backtrace.length= 0;
    }
  }


  /**
  * Match Trace class
  * Creates a record of the matching process. Grammar nodes each append a line of text.
  * When disabled all methods become NOP
  **/
  class MatchTrace {
    constructor() {
      this.builder= new StringBuilder();
      this.depthPadding= '';
      this.enabled= true;
    }

    enable( v ) {
      this.enabled= v;
    }

    /** @param {StringIterator} it **/
    append( it, msg ) {
      if( this.enabled ) {
        this.builder.append( 'at line ', it.toString().padEnd(8), this.depthPadding, unwrapMessageCb( msg ), '\n' );
      }
    }

    pushDepth() {
      if( this.enabled ) {
        this.depthPadding+= '  ';
      }
    }

    popDepth() {
      if( this.enabled ) {
        assert( this.depthPadding.length >= 2, 'Cannot pop from match trace' );
        this.depthPadding= this.depthPadding.slice(0, -2);
      }
    }

    toString() {
      return this.builder.toString();
    }

    clear() {
      this.builder= new StringBuilder();
    }
  }


  /**
  * Grammar Node Base class
  * Base class for all types of grammar nodes representing a grammar.
  * Constructs nodes from tokens via factory and handles all common logic like
  * repetition, generator configuration and tree recursion.
  **/
  class GrammarNode {
    /** @param tk {Token} **/
    constructor( tk ) {
      this.position= tk.pos;

      this.minRepetition= 1;
      this.maxRepetition= 1;

      this.minGenRepetition= 1;
      this.maxGenRepetition= 1;
      this.powGenRepetition= 1;

      this.name= null;
    }

    static create( tk, ...args ) {
      switch( tk.type ) {
        case Token.None:
          throw Error('None token found');

        case Token.String:
          return new TerminalNode( tk );

        case Token.Name:
          return new NonTerminalNode( tk );

        case Token.CharClass:
          return new CharClassNode( tk );

        case Token.PosLookAhead:
          return new PosLookAheadNode( tk, ...args );

        case Token.NegLookAhead:
          return new NegLookAheadNode( tk, ...args );

        case Token.Cut:
          return new CutNode( tk );

        default:
          tk.throwError('Unexpected token: Cannot create grammar node from token type');
      }
    }

    setName( tk ) {
      if( tk.data() ) {
        assert( !this.name, () => tk.throwError('Node may not have multiple names') );
        this.name= tk.data();
      }
    }

    setParent() { /* NOP */ }

    setQuantity( tk ) {
      this.setName( tk );

      switch( tk.type ) {
        case Token.MinOne:
          this.minRepetition= 1;
          this.maxRepetition= -1;
          break;

        case Token.Optional:
          this.minRepetition= 0;
          this.maxRepetition= 1;
          break;

        case Token.RepeatMany:
          this.minRepetition= 0;
          this.maxRepetition= -1;
          break;

        case Token.Repeat:
          this._parseRepetitionQuantifier( tk );
          break;

        default:
          tk.throwError('Expected quantifier token');
      }

      this.minGenRepetition= this.minRepetition;
      this.maxGenRepetition= (this.maxRepetition < 0) ? Interpreter.the().config().maxGenRepetition : this.maxRepetition;
    }

    _parseRepetitionQuantifier( tk ) {
      const str= tk.optionalData();
      assert( str, () => tk.throwError('Expected range data for repetition quantifier') );

      const nums= str.substring( 1, str.lastIndexOf('}') ).split(',');
      if( nums.length > 2 ) {
        tk.throwError('Invalid repetition format');
      }

      if( nums.length === 1 ) {
        const s= nums[0].trim();
        this.minRepetition= this.maxRepetition= parseInt( s );

      } else {
        const l= nums[0].trim();
        this.minRepetition= l.length ? parseInt( l ) : 0;

        const r= nums[1].trim();
        this.maxRepetition= r.length ? parseInt( r ) : -1;
      }

      if( Number.isNaN( this.minRepetition ) || Number.isNaN( this.maxRepetition ) ) {
        tk.throwError('Invalid repetition format');
      }
    }

    parsingState() {
      abstractMethod();
    }

    tryMatch() {
      abstractMethod();
    }

    matchErrorString() {
      abstractMethod();
    }

    generateSingle() {
      abstractMethod();
    }

    setGeneratorConfig( config ) {
      config= Object.assign({
        max: this.maxGenRepetition,
        min: this.minGenRepetition,
        pow: this.powGenRepetition
      }, config);

      if( config.min < this.minRepetition ) {
        throw Error('Generator min repetition is lower than grammar rule');
      }

      if( (this.maxRepetition >= 0 && config.max > this.maxRepetition) || (config.max < 0 && this.maxRepetition >= 0)) {
        throw Error('Generator max repetition is greater than grammar rule');
      }

      if( config.pow < 0 ) {
        throw Error('Generator repetition power is smaller than zero');
      }

      this.maxGenRepetition= config.max;
      this.minGenRepetition= config.min;
      this.powGenRepetition= config.pow;
    }

    getNodeByName( name ) {
      return ( name === this.name ) ? this : null;
    }

    linkExpression() { /* NOP */ }

    match( it ) {
      let cntr= 0;
      while( it.hasNext() && this.tryMatch( it ) ) {
        if( (++cntr >= this.maxRepetition) && (this.maxRepetition >= 0) ) {
          break;
        }
      }

      return cntr >= this.minRepetition;
    }

    generate( builder ) {
      const int= Interpreter.the();
      int.generationDepth++;

      const factor= Math.pow( Math.random(), this.powGenRepetition );
      const rep= Math.round( this.minGenRepetition* (1- factor) + this.maxGenRepetition* factor );

      for( let i= 0; i!== rep; i++ ) {
        this.generateSingle( builder );
      }

      int.generationDepth--;
    }

    isRecursive() {
      return false;
    }
  }


  class GrammarTreeNode extends GrammarNode {
    /** @param tk {Token} **/
    constructor( tk, p ) {
      super( tk );

      /** @type {GrammarTreeNode} **/
      this.parentExpr= p;
    }

    parent() {
      return this.parentExpr;
    }

    setParent( p ) {
      this.parentExpr= p;
    }

    forEachParent( fn ) {
      let node= this;
      while( node ) {
        fn( node );
        node= node.parentExpr;
      }
    }

    addNode() {
      abstractMethod();
    }

    getNodeByName() {
      abstractMethod();
    }
  }

  /**
  * Subexpression Grammar Node
  * Represents expressions grouped by parenthesis
  **/
  class SubExpressionNode extends GrammarTreeNode {
    /** @param tk {Token} **/
    constructor( tk, p ) {
      super( tk, p );

      /** @type {[GrammarNode]} **/
      this.children= [];
    }

    parsingState() {
      return State.SubExpression;
    }

    addNode( n ) {
      this.children.push( n );
    }

    linkExpression( map ) {
      this.children.forEach( c => c.linkExpression( map, this ) )
    }

    setGeneratorConfig( config ) {
      super.setGeneratorConfig( config );

      // Pass down the config to an alternative node if one exists
      this.children.some( c => {
        if( c instanceof AlternativeNode ) {
          c.setGeneratorConfig( config );
          return true;
        }

        return false;
      });
    }

    getNodeByName( name ) {
      if( this.name === name ) {
        return this;
      }

      let fnd= null;
      this.children.some( c => fnd= c.getNodeByName(name) );

      return fnd;
    }

    tryMatch( it ) {
      const int= Interpreter.the();
      int.matchTrace().pushDepth();

      const testIt= it.copy();

      // Try to match every child
      const hasError= this.children.some( c => {
        const pos= testIt.position();

        if( !c.match( testIt ) ) {
          int.matchError().append( this, pos );

          return true;
        }

        return false;
      });

      int.matchTrace().popDepth();

      // Move the global iterator if the match was successfull
      if( !hasError ) {
        it.set( testIt );

      } else {
        int.matchTrace().append(it, '() Could not match SubExpression');
      }

      return !hasError;
    }

    matchErrorString() {
      return 'Could not match SubExpression';
    }

    generateSingle( builder ) {
      this.children.forEach( c => c.generate( builder ) );
    }

    isRecursive() {
      return this.children.some( c => c.isRecursive() );
    }
  }

  /**
  * Alternative Grammar Node
  * Represents alternative expressions grouping expressions with pipe characters
  **/
  class AlternativeNode extends SubExpressionNode {
    /** @param tk {Token} **/
    constructor( tk, p ) {
      super( tk, p );

      this.dist= null;
      this.nonRecursiveDist= null;
      this.cutFlag= false;
    }

    setCutFlag( v= true ) {
      this.cutFlag= v;
    }

    parsingState() {
      return State.Alternative;
    }

    setGeneratorConfig( config ) {
      config= Object.assign({
        dist: Array( this.children.length ).fill( 1 )
      }, config );

      assert( config.dist.length === this.children.length, 'Configured distribution has the wrong number of weights' );

      this.dist= new RangeDistribution( this.children, (d, i) => config.dist[i] )
    }

    tryMatch( it ) {
      const int= Interpreter.the();
      int.matchTrace().append(it, '| Matching alternative expression');
      int.currentAlternativeExp().push( this );

      this.cutFlag= false;

      // Try to match each child individually
      let result;
      this.children.some( (c, i) => {
        const testIt= it.copy();

        if( i ) {
          int.matchTrace().append(testIt, '| Matching alternative option')
        }
        int.matchTrace().pushDepth();

        const childResult= c.match(testIt);

        // Found a match -> update the global iterator
        if( childResult ) {
          it.set( testIt );
        }

        int.matchTrace().popDepth();

        // Don't consider any more children after a cut expr
        result= childResult;
        return childResult || this.cutFlag;
      });

      // No child matches
      if( !result ) {
        int.matchError().append( this, it.position() );
        int.matchTrace().append( it, () => {
          let s= '| Could not match any option';
          s+= this.cutFlag ? ' (Stopped due to cut expression)' : '';

          return s;
        });
      }

      int.currentAlternativeExp().pop();
      return result;
    }

    matchErrorString() {
      return 'Could not match AlternativeExpression';
    }

    _getNonRecursiveOption() {
      if( !this.nonRecursiveDist ) {
        this.nonRecursiveDist= new RangeDistribution( this.children, c => c.isRecursive() ? 0 : 1 );
      }

      return this.nonRecursiveDist.random();
    }

    generateSingle( builder ) {
      // Create defaut distribution
      if( !this.dist ) {
        this.dist= new RangeDistribution( this.children, () => 1 );
      }

      // Only consider non recursive options if the maximal depth is reached
      const int= Interpreter.the();
      if( int.generationDepth > int.config().maxGenDetph ) {
        const node= this._getNonRecursiveOption();

        if( !node ) {
          builder.append('<generation depth overflow>');
          return;
        }

        node.generate( builder );
        return;
      }

      this.dist.random().generate( builder );
    }

    isRecursive() {
      // Check if there is a non recursive option available
      const x= this._getNonRecursiveOption();
      return x ? true : false;
    }
  }

  /**
  * Expression Grammar Node
  * Represents a named rule defined as multiple expressions
  **/
  class ExpressionNode extends SubExpressionNode {
    /** @param tk {Token} **/
    constructor( tk ) {
      super( tk, null );

      if( !tk.is( Token.Name ) ) {
        tk.throwError('Expected name token to create expression');
      }

      this.name= tk.data();
    }

    parsingState() {
      return State.Expression;
    }

    matchErrorString() {
      return `Could not match Expression: '${ this.name }'`;
    }

    tryMatch( it ) {
      Interpreter.the().matchTrace().append(it, () => `() Matching expression '${this.name}'`);
      return super.tryMatch( it );
    }
  }

  /**
  * Terminal Grammar Node
  * Represents a string expected to match
  **/
  class TerminalNode extends GrammarNode {
    /** @param tk {Token} **/
    constructor( tk ) {
      super( tk );

      this.str= tk.data();
    }

    tryMatch( it ) {
      const int= Interpreter.the();

      if( !it.consume( this.str ) ) {
        int.matchTrace().append(it, () => `# Could not match terminal '${this.str}'`);
        int.matchError().error( this, it );
        return false;
      }

      int.matchTrace().append(it, () => `# Matched terminal '${this.str}'`);
      return true;
    }

    matchErrorString() {
      return `Could not match Terminal: '${ this.str }'`;
    }

    generateSingle( builder ) {
      builder.append( this.str );
    }
  }


  /**
  * Look Ahead Grammar Node Base
  * Represents either a positive or negative look ahead using an exclamation mark or ampersand.
  * Whether the match should succeed or fail is defined by overriding this class.
  **/
  class LookAheadNode extends GrammarTreeNode {
    /** @param tk {Token} **/
    constructor( tk, p ) {
      super( tk, p );

      this.childExpr= null;
    }

    parsingState() {
      return State.LookAhead;
    }

    /** @param n {GrammarNode} **/
    addNode( n ) {
      assert( !this.childExpr, 'Multiple look ahead children' );
      this.childExpr= n;
    }

    linkExpression( map ) {
      assert( this.childExpr, 'Empty look ahead node' );
      this.childExpr.linkExpression( map, this );
    }

    _shouldMatch() {
      abstractMethod();
    }

    tryMatch( it ) {
      const int= Interpreter.the();
      const trace= int.matchTrace();
      const testIt= it.copy();

      trace.append(it, '# Match lookahead')

      trace.pushDepth();
      const result= this.childExpr.match( testIt );

      trace.popDepth();

      if( result !== this._shouldMatch() ) {
        trace.append(it, '# Could not match look ahead');
        int.matchError().error( this, it );
        return false;
      }

      trace.append(it, '# Matched look ahead');
      return true;
    }

    matchErrorString() {
      return 'Could not match lookahead';
    }

    generateSingle() { /* NOP */}
  }

  class PosLookAheadNode extends LookAheadNode {
    _shouldMatch() {
      return true;
    }
  }

  class NegLookAheadNode extends LookAheadNode {
    _shouldMatch() {
      return false;
    }
  }


  /**
  * Cut Grammar Node
  * Represents a cut expression using a tilde
  **/
  class CutNode extends GrammarNode {
    /** @param tk {Token} **/
    constructor( tk ) {
      super( tk );
    }

    tryMatch( it ) {
      const int= Interpreter.the();
      const stack= int.currentAlternativeExp();

      if( stack.length ) {
        int.matchTrace().append(it, '~ Cut expression');

        stack[stack.length-1].setCutFlag();
      }

      return true;
    }

    matchErrorString() {
      return '';
    }

    linkExpression( map, parent ) {
      // Check if any of the parent nodes is an alternative node
      let hasAlternativeNode= false;
      parent.forEachParent( p => hasAlternativeNode |= (p instanceof AlternativeNode) );

      if( !hasAlternativeNode ) {
        Interpreter.the().parseWarnings().append('Warning at line ', this.position.toString(), ': No alternative expression for cut expression found');
      }
    }

    generateSingle() { /* NOP */ }
  }


  /**
  * Nonterminal Grammar Node
  * Represents a recursion into another named rule expression
  **/
  class NonTerminalNode extends GrammarNode {
    /** @param tk {Token} **/
    constructor( tk ) {
      super( tk );

      this.exprName= tk.str;
      /** @type {ExpressionNode} **/
      this.expression= null;
    }

    linkExpression( map ) {
      this.expression= map.get( this.exprName );
      if( !this.expression ) {
        throw Error('Referencing unknown expression: '+ this.exprName );
      }
    }

    tryMatch( it ) {
      // In case of an error, the name of the expression is added to the match error by the expr itself
      return this.expression.tryMatch( it );
    }

    generateSingle( builder ) {
      this.expression.generateSingle( builder );
    }

    isRecursive() {
      return true;
    }
  }

  /**
  * Charclass Grammar Node
  * Represents a terminal string consisting of characters defined inside square brackets
  **/
  class CharClassNode extends GrammarNode {
    /** @param tk {Token} **/
    constructor( tk ) {
      super( tk );

      assert( tk.data(), () => tk.throwError('Cannot create char class node from empty token') );

      this.data= tk.data();
      this.classList= null;

      this._parseCharClass();

      this.dist= new RangeDistribution( this.classList, c => c.length() );
    }

    _parseCharClass() {
      const it= new StringIterator( this.data );

      assert( it.next() === '[', `Expected '[' at beginning of char class: ${this.data}` );
      assert( it.peak() !== '^', `Inverted character classes are not supported: ${this.data}` );

      this.classList= [];

      let fragmentList= '';

      while( it.hasNext() ) {
        it.next();

        if( it.is('\\') ) {
          switch( it.next() ) {
            case 's':
              this.classList.push( FragmentedCharClass.WhiteSpace );
              continue;

            case 'd':
              this.classList.push( RangeCharClass.Digit );
              continue;

            case 'w':
              this.classList.push( RangeCharClass.Digit );
              this.classList.push( RangeCharClass.AlphaUpper );
              this.classList.push( RangeCharClass.AlphaLower );
              fragmentList+= '_';
              continue;

            case '.':
              this.classList.push( RangeCharClass.Digit );
              this.classList.push( RangeCharClass.AlphaUpper );
              this.classList.push( RangeCharClass.AlphaLower );
              this.classList.push( FragmentedCharClass.WhiteSpace );
              this.classList.push( FragmentedCharClass.Specials );
              continue;

            case 'S':
            case 'W':
            case 'D':
              throw Error(`Inverted versions of built in classes 'S', 'W' & 'D' are not supported: ${this.data}`);

            case 'b':
            case 'c':
            case 'x':
            case 'u':
            case 'p':
              throw Error(`Escape codes 'b', 'c', 'x', 'u' & 'p' are not supported: ${this.data}`);

            default:
                fragmentList+= it.get();
                break;
          }
        }

        // End
        if( it.get() === ']' ) {
          break;
        }

        // Create range
        if( it.peak() === '-' ) {
          const s= it.get();

          it.next();
          if( !it.hasNext() || it.peak() === ']' ) {
            throw Error(`Unfinished character class range: ${this.data}`);
          }

          it.next();
          const e= it.get();

          this.classList.push( new RangeCharClass(s, e) );
          continue;
        }

        // Add to framgent list
        fragmentList+= it.get();
      }

      if( fragmentList.length ) {
        this.classList.push( new FragmentedCharClass(fragmentList) );
      }
    }

    tryMatch( it ) {
      const int= Interpreter.the();

      const fnd= this.classList.some( c => c.contains( it.get() ) );
      if( fnd ) {
        it.next();
        int.matchTrace().append(it, () => '[] Matched character class'+ this.data);
        return true;
      }

      int.matchTrace().append(it, () => '[] Could not match character class'+ this.data);
      int.matchError().error( this, it );

      return false;
    }

    matchErrorString() {
      let regex= ''+ this.data;
      regex= regex.substring( 1, regex.length- 1 );
      return `Could not match CharacterClass: '${ regex }'`;
    }

    generateSingle( builder ) {
      builder.append( this.dist.random().generateSingle() );
    }
  }


  // Parser states
  const State= {
    None:          { id: 0, name: 'None' },
    Expression:    { id: 1, name: 'Exression' },
    SubExpression: { id: 2, name: 'SubExression' },
    Alternative:   { id: 3, name: 'Alternative' },
    LookAhead:     { id: 4, name: 'LookAhead' }
  };


  /**
  * Interpreter class
  * Parses a grammar from an EBNF source string. Matches a provided text against
  * the grammar or generates a random text based on the grammar.
  **/
  class Interpreter {
    constructor( config ) {

      this.sourceIterator= null;
      this.expressions= null;
      this.currentAltExp= [];
      this.matchErrorObj= new MatchError();
      this.matchTraceObj= new MatchTrace();
      this.parseWarnBuilder= new StringBuilder();

      this.configObj= Object.assign({
        maxGenRepetition: 128,
        maxGenDetph: 128,
        createMatchTrace: false
      }, config);

      this.matchTraceObj.enable( this.configObj.createMatchTrace );

      this.generationDepth= 0;
    }

    static the() {
      return Interpreter._instance;
    }

    _instanceGuard( fn ) {
      Interpreter._instance= this;
      const res= fn();
      Interpreter._instance= null;

      return res;
    }

    config() {
      return this.configObj;
    }

    parse( source ) {
      this._instanceGuard(() => {
        this.expressions= new Map();

        const it= this.sourceIterator= new TokenIterator( source );

        let state= State.None;

        let exprRoot= null;
        let subexpr= null;

        while( it.hasNext() ) {
          const token= it.next();

          switch( state ) {
            case State.None:
              // Begin new expression
              if( !token.is( Token.Name ) ) {
                token.throwError('Expected name token');
              }
              if( !it.next().is( Token.Define ) ) {
                token.throwError('Expected define token');
              }

              exprRoot= subexpr= new ExpressionNode( token );
              this._addExpression( exprRoot, token );
              state= State.Expression;
              break;

            case State.Expression:
              // End current expression if a definition of a new one follows
              if( token.is( Token.Name ) ) {
                if( it.peak().is( Token.Define ) ) {
                  it.next();

                  exprRoot= subexpr= new ExpressionNode( token );
                  this._addExpression( exprRoot, token );
                  break;
                }
              }
              // Fall through

            case State.Alternative:
            case State.LookAhead:
            case State.SubExpression:
              // Begin sub exp
              if( token.is( Token.ExpStart ) ) {
                subexpr= new SubExpressionNode( token, subexpr );
                state= State.SubExpression;
                break;
              }

              // Begin look ahead
              if( token.is( Token.PosLookAhead, Token.NegLookAhead ) ) {
                if( state === State.LookAhead ) {
                  token.throwError('Expected expression for lookahead before the next one starts');
                }

                const node= GrammarNode.create( token, subexpr );
                subexpr.addNode( node );

                subexpr= node;
                state= State.LookAhead;
                break;
              }

              // End sub exp
              let node= null;
              if( token.is( Token.ExpEnd ) ) {
                // End an active alternative before
                if( state === State.Alternative ) {
                  subexpr= subexpr.parent();
                  state= subexpr.parsingState();
                }

                if( state === State.LookAhead ) {
                  token.throwError('Expected expression for lookahead');
                }

                if( state !== State.SubExpression ) {
                  token.throwError('Found end of subexpression token outside a subexpression');
                }

                // Set name of sub expr if the exp end token has one
                subexpr.setName( token );

                node= subexpr;
                subexpr= subexpr.parent();
                state= subexpr.parsingState();

              // Regular token
              } else {
                // Create grammar node to add to current subexpression
                node= GrammarNode.create( token );
              }

              // Try to add a quantifier
              if( it.peak().isQuantifier() ) {
                node.setQuantity( it.next() );
              }

              // Begin sub exp with an ALternative Node
              if( it.peak().is( Token.Or ) && (state !== State.Alternative) ) {
                const orNode= new AlternativeNode( it.peak(), subexpr );

                node.setParent( orNode );

                subexpr.addNode( orNode );
                subexpr= orNode;
                state= State.Alternative;
              }

              subexpr.addNode( node );

              // End look ahead after adding a single node
              if( state === State.LookAhead ) {
                subexpr= subexpr.parent();
                state= subexpr.parsingState();
              }

              // End Alternative Node when no 'or' tokens follow
              if( state === State.Alternative ) {
                // Always jump over the 'or' token
                if( it.peak().is( Token.Or ) ) {
                  it.next();

                // End of the alternative node
                } else {
                  subexpr= subexpr.parent();
                  state= subexpr.parsingState();
                }
              }

              break;
          }
        }

        if( exprRoot ) {
          if( subexpr !== exprRoot ) {
            throw Error('Unexpected end of sub-expression in: '+ exprRoot.name );
          }
        }

        //console.log('Expressions: ', this.expressions)

        // Link all expressions
        this.expressions.forEach( e => e.linkExpression(this.expressions) );
      });
    }

    _addExpression( exprRoot, token ) {
      if( this.expressions.has( exprRoot.name ) ) {
        token.throwError('Redefining expression: '+ exprRoot.name );
      }

      this.expressions.set( exprRoot.name, exprRoot );
    }

    matchErrorString() {
      return 'Interpreter';
    }

    currentAlternativeExp() {
      return this.currentAltExp;
    }

    _getExpression( exprName ) {
      assert( this.expressions, 'No expressions parsed' );

      const expr= this.expressions.get( exprName );
      assert( expr, () => `Unknown expression name: '${exprName}'` );

      return expr;
    }

    matchError() {
      return this.matchErrorObj;
    }

    matchTrace() {
      return this.matchTraceObj;
    }

    parseWarnings() {
      return this.parseWarnBuilder;
    }

    match( exprName, str ) {
      return this._instanceGuard(() => {
        const expr= this._getExpression( exprName );

        const it= new StringIterator( str );
        it.next();

        if( expr.match( it ) ) {
          if( !it.hasNext() ) {
            // Clear any residual errors
            this.matchErrorObj.clear();

            return true;
          }

          this.matchError().error( this, it, `There are unmatched characters left: '${it.splitString()}'` );
        }

        return false;
      });
    }

    generate( exprName ) {
      return this._instanceGuard(() => {
        const expr= this._getExpression( exprName );

        this.generationDepth= 0;

        const builder= new StringBuilder();
        expr.generate( builder );

        return builder.toString();
      });
    }

    setGeneratorConfig( exprName, config ) {
      this._instanceGuard(() => {
          const expr= this._getExpression( exprName );

          for( const nodeName in config ) {
            const node= expr.getNodeByName( nodeName );
            assert( node, () => `Unknown node name '${nodeName}' in config for expr '${exprName}'`);

            node.setGeneratorConfig( config[nodeName] );
          }
      });
    }
  }

  /** @type {Interpreter} **/
  Interpreter._instance= null;



  const exportObject= {
    Interpreter,
    Util: {
      isWhitespace,
      isWordChar,
      isAlphaChar,
      isOperator,
      assert
    }
  };

  if( typeof module === "object" ) {
    module.exports= exportObject;

  } else if( typeof window === 'object' ) {
    window.grammar= exportObject;
  }


})();
