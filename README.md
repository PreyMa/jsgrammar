# jsgrammar
A simple EBNF matcher and generator written in JS

## Contents
1. Usage - CLI
2. Usage - Library
3. EBNF Syntax
4. Config File
5. Links
6. License

## Usage - CLI
Run the module folder with node and add your CLI options.

```bash
node jsgrammar -m myRule myFileToMatch.txt
```

You need to provide a grammar file containing the EBNF rules. With the `--config` option either specify a JSON config file containing the path or a path to a text file. If the option is ommited `--config ebnf.json` is assumed, which will try to load the config file `ebnf.json`.

| Option         | Arguments  | Description                                                                                                           |
|----------------|------------|-----------------------------------------------------------------------------------------------------------------------|
| --help, -h     |            | Prints a help message                                                                                                 |
| --config, -c   | file       | `file` is either a path to a JSON config file, or to a plain text containing the EBNF source                          |
| --match, -m    | rule, file | Matches text from a `file` against a named `rule`                                                                     |
| --generate, -g | rule, file | Generates a random text from a named `rule` and saves it in a `file`                                                  |
| --trim, -t     |            | Remove leading and trailing whitspace from the input file and reduce all other whitespace to a sinlge space character |
| --trimAll, -ta |            | Remove all whitespace from the input file                                                                             |

## Usage - Library
Just require it like any other CommonJS module. The CLI code won't be loaded if the module is required by your code.

```JS
  const {Interpreter}= require('jsgrammar');
```

Check out the CLI on how to use the interpreter as a library.


## EBNF Syntax
The syntax expected by the module is mostly identical to the standard EBNF, but it also supports some quality of life extensions.

Define a rule with a name, `::=` and it's child expressions and use it inside other ones by it's name. Terminal symbols (aka strings) may be defined with double and single quotes. Characters can be escaped C-style with `\`.
```text
myRule ::= 'hello' "world"

myOtherRule ::= myRule '!'
```

C-style line and block comments are supported.
```text
// The following rule is parsed
IamParsed ::= 'hello' 'world'

/* The following rule is ignored
IamIgnored ::= 'hello' 'sailor'
*/
```

Allowed repetition quantifiers are: `?`, `+`, `*` and `{}`. No quantifier means, that the expresion is expected once. `?` makes it optional, or in other words a minimum of zero and maximum of one repetition.  `+` expectecs a minimum of one occurances and a maximum of unlimitted rpetitions. `*` allows from zero to unlimitted occurances.

To define a custom range the `{}` quantifier can be used. It accepts a minimum and maximum value (eg. `'a'{10,20}`). If no minimum is specified (eg. `'a'{,10}`), a minimum of zero is assumed, making it equivalent to `*` with an upper limit. No maximum allows for unlimitted repetitions (eg. `'a'{10,}`), making it equivalent to `+` with a minimum different to one.
```text
myRule ::= 'hello'? 'world'+ '!'*

myOtherRule ::= 'hello'{10,20} 'sailor'{10,} '!'{,10}
```

Child expressions can be grouped as a subexpressions using parenthesis `()`. Alternative options are grouped by pipe characters `|`.
```text
myRule ::= 'match me' | 'or me' | 'or me'

myOtherRule ::= ('repeat us both' myRule)*
```

To define a whole class of possible characters to match a character class can be used instead of stringing multiple terminals into a large alternative expression. A character class is made up of a list of possible characters to match enclosed inside square brackets like `[abcdef]`. Similar to regex char classes ranges can be defined like `[a-f]`. To define upper, lower case characters and underscore as class write `[a-zA-Z_]`. Or you could use the predefined class `[\w]` if you also wanted to include digits. Characters inside the class are C-style escaped using `\` (eg `[\\\]]` -> `\` and `]`).

Supported predefined classes are:

| Class | Name       | Characters                                             |
|-------|------------|--------------------------------------------------------|
| \s    | Whitespace | `' \f\n\r\t\v'`                                        |
| \d    | Digits     | `'0123456789'`                                         |
| \w    | Word       | `'a...zA...Z_'`                                        |
| \\.    | Any        | all above plus ```'!"#$%&\'()*+,-./:;<=>?@[\\]^_`{\|}~'``` |

Inverted classes and inverted predefined classes (eg `\S`) like in regex are not supported.
```text
myRule ::= [EBNF] [abcSTUV] [a-zQRVW] [\dabcd]
```


To configure the text generator each expression's repetition quantifier can be named to define more precise repetiton boundries and randomness distribution. To name a quantifier or respectively the expression use `.name`. Expressions without a quantifier can also be named. Alternative expressions cannot be named directly. If you need to specify parameters for it you need to wrap it with a named subexpression and define the values there.

```text
myRule ::= 'my name is foo'.foo 'i am called bar'*.bar

myOtherRule ::= 'call me foobar'{1,5}.foobar

myAnotherRule ::= ('call' | 'my' | 'parent' | 'baz')?.baz
```


## Config File
The config file loaded with the `--config` option is a simple JSON file which is required to at least have a `grammar` field specifying a path to a text file with the EBNF source.

To configure the text generator create a `generator` field. For example the following EBNF might be configured like this:

```
rule1 ::= 'hello'+.a 'world'*.b '!'{,6}.c

rule2 ::= (rule1 | 'servus' | 'bye')*.a
```

```json
{
  "grammar": "myGrammar.txt",
  "generator": {
    "rules": {
      "rule1": {
        "a": { "pow": 1 },
        "b": { "pow": 10, "min": 10, "max": 100 },
        "c": { "pow": 0.1 }
      },
      "rule2": {
        "a": {
          "max": 99,
          "dist": [10, 5, 1]
        }
      }
    }
  }
}
```
Each rule defines parameters for its named subexpressions. These are the possible parameters that can be set:

| Name | Type     | Default                                | Description                           |
|------|----------|----------------------------------------|---------------------------------------|
| min  | number   | min repetitions defined in the grammar | Min number of repetitions             |
| max  | number   | max repetitions defined in the grammar | Max number of repetitions             |
| pow  | number   | 1                                      | Power factor for repetitions          |
| dist | [number] | [1,1,...]                              | Distribution weights for alternatives |

`min` and `max` parameters need to inside the bounds defined by the grammar. A terminal defined as `'hello'{1,10}.a` may not have a `min` value below 1 or a `max` value above 10.

The `pow` parameter is usefull to change the probability of repetition lenght when generating text. Every random number used to determine the length of a repetition is taken to the power of this value. By specifying a large value, the random number is multiplied with itself multiple times, making it smaller. This creates a parabola, which favors smaller values. Using a value inbetween zero and one, the n-th root is taken from the random value, resulting in larger values. As all random numbers are inbetween 0 to 1 no overflow occurs.

An alternative expression inside a named subexpression (eg. `( 'a' | 'b' ).x`) may have it's random distribution set via the `dist` param. As the alternative node cannot be named directly the param is set on its parent subexpression. The value is an array of numbers, setting a weight for each option in the alternative node. The weights are summed and a weight's percentage of the sum is used to determine it's likelyhood to be selected. The array `[90, 10]` would select the terminal `a` in 90% of all cases, and `b` in 10% of all cases.


## Links
* My website: [egimoto.com](https://www.egimoto.com)
* EBNF visualizer: [bottlecaps.de](https://www.bottlecaps.de/rr/ui)*
* Introduction to EBNF: [wikipedia.org](https://en.wikipedia.org/wiki/Extended_Backus%E2%80%93Naur_form)

*No support for some of the extended syntax features of this module

## License
This project is licensed under the MIT license.
