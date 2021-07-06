# jsgrammar
A simple EBNF matcher and generator written in JS

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
Just require it like any other CommonJS module. The CLI code won't be loaded if the module is required by another one.

```JS
  const {Interpreter}= require('jsgrammar');
```

Check out the CLI on how to use the interpreter as a library.


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
