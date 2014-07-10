var porLineParser = require("./line-parser");

var STATES = 0,
    STATE_FILE_HEADER = ++STATES,
    STATE_VERSION = ++STATES,
    STATE_CREATION_DATE = ++STATES,
    STATE_CREATION_TIME = ++STATES,
    STATE_TAG = ++STATES,
    STATE_PRODUCT_IDENTIFICATION = ++STATES,
    STATE_AUTHOR_IDENTIFICATION = ++STATES,
    STATE_SUBPRODUCT_IDENTIFICATION = ++STATES,
    STATE_VARIABLE_COUNT = ++STATES,
    STATE_AFTER_VARIABLE_COUNT = ++STATES,
    STATE_CASE_WEIGHT_VARIABLE = ++STATES,
    STATE_VARIABLE = ++STATES,
    STATE_VALUE_LABEL = ++STATES,
    STATE_DOCUMENT = ++STATES,
    STATE_FIRST_DATUM = ++STATES,
    STATE_DATA = ++STATES,
    STATE_EOF = ++STATES;

var FIELD_STATE_DEFAULT = ++STATES,
    FIELD_STATE_AFTER_ASTERISK = ++STATES;

var STRING_STATE_DEFAULT = ++STATES,
    STRING_STATE_AFTER_LENGTH = ++STATES;

var VARIABLE_STATE_WIDTH = ++STATES,
    VARIABLE_STATE_NAME = ++STATES,
    VARIABLE_STATE_PRINT_FORMAT_TYPE = ++STATES,
    VARIABLE_STATE_PRINT_FORMAT_WIDTH = ++STATES,
    VARIABLE_STATE_PRINT_FORMAT_PRECISION = ++STATES,
    VARIABLE_STATE_WRITE_FORMAT_TYPE = ++STATES,
    VARIABLE_STATE_WRITE_FORMAT_WIDTH = ++STATES,
    VARIABLE_STATE_WRITE_FORMAT_PRECISION = ++STATES,
    VARIABLE_STATE_TAG = ++STATES,
    VARIABLE_STATE_MISSING_VALUE = ++STATES,
    VARIABLE_STATE_MISSING_VALUE_RANGE_LO = ++STATES,
    VARIABLE_STATE_MISSING_VALUE_RANGE_HI = ++STATES,
    VARIABLE_STATE_LO_THRU_X = ++STATES,
    VARIABLE_STATE_X_THRU_HI = ++STATES,
    VARIABLE_STATE_LABEL = ++STATES,
    VARIABLE_STATE_END = ++STATES;

var CODE_FORWARD_SLASH = "/".charCodeAt(0),
    CODE_ASTERISK = "*".charCodeAt(0),
    CODE_SPACE = " ".charCodeAt(0),
    CODE_PERIOD = ".".charCodeAt(0),
    CODE_PLUS = "+".charCodeAt(0),
    CODE_MINUS = "-".charCodeAt(0);

var STATE_BY_TAG = {
  "1": STATE_PRODUCT_IDENTIFICATION,
  "2": STATE_AUTHOR_IDENTIFICATION,
  "3": STATE_SUBPRODUCT_IDENTIFICATION,
  "4": STATE_VARIABLE_COUNT,
  "6": STATE_CASE_WEIGHT_VARIABLE,
  "7": STATE_VARIABLE,
  "D": STATE_VALUE_LABEL,
  "E": STATE_DOCUMENT,
  "F": STATE_FIRST_DATUM,
  "Z": STATE_EOF
};

var VARIABLE_STATE_BY_TAG = {
  "8": VARIABLE_STATE_MISSING_VALUE,
  "9": VARIABLE_STATE_LO_THRU_X,
  "A": VARIABLE_STATE_X_THRU_HI,
  "B": VARIABLE_STATE_MISSING_VALUE_RANGE_LO,
  "C": VARIABLE_STATE_LABEL
};

module.exports = function() {
  var parser = {
      push: parser_push,
      pop: parser_pop
    },
    state = STATE_FILE_HEADER,
    encoding = "utf8",
    lineParser = porLineParser(),
    line = new Buffer(0),
    lineLength = 0,
    fieldState = FIELD_STATE_DEFAULT,
    fieldLength = 0,
    stringState = STRING_STATE_DEFAULT,
    stringLength = null,
    variableIndex = 0,
    variableState = VARIABLE_STATE_WIDTH,
    variableWidth = null,
    variableName = null,
    variablePrintFormatType = null,
    variablePrintFormatWidth = null,
    variablePrintFormatPrecision = null,
    variableWriteFormatType = null,
    variableWriteFormatWidth = null,
    variableWriteFormatPrecision = null,
    variableMissingValues = [],
    variableMissingValueRange = null,
    variableLabel = null,
    variables = [],
    data = [],
    dataOffset = 0,
    rowIndex = -1;

  function parser_push(data) {
    lineParser.push(data);
  }

  function parser_pop() {
    var record;
    while (true) {
      switch (state) {
        case STATE_FILE_HEADER: {
          if ((record = popFixed(464)) == null) return null;
          state = STATE_VERSION;
          continue;
        }
        case STATE_VERSION: {
          if ((record = popFixed(1)) == null) return null;
          state = STATE_CREATION_DATE;
          continue;
        }
        case STATE_CREATION_DATE: {
          if ((record = popString()) == null) return null;
          state = STATE_CREATION_TIME;
          continue;
        }
        case STATE_CREATION_TIME: {
          if ((record = popString()) == null) return null;
          state = STATE_TAG;
          continue;
        }
        case STATE_TAG: {
          if ((record = popFixed(1)) == null) return null;
          state = STATE_BY_TAG[record.toString(encoding)];
          continue;
        }
        case STATE_PRODUCT_IDENTIFICATION: {
          if ((record = popString()) == null) return null;
          state = STATE_TAG;
          continue;
        }
        case STATE_AUTHOR_IDENTIFICATION: {
          if ((record = popString()) == null) return null;
          state = STATE_TAG;
          continue;
        }
        case STATE_SUBPRODUCT_IDENTIFICATION: {
          if ((record = popString()) == null) return null;
          state = STATE_TAG;
          continue;
        }
        case STATE_VARIABLE_COUNT: {
          if ((record = popInteger()) == null) return null;
          state = STATE_AFTER_VARIABLE_COUNT;
          continue;
        }
        case STATE_AFTER_VARIABLE_COUNT: {
          if ((record = popInteger()) == null) return null;
          state = STATE_TAG;
          continue;
        }
        case STATE_CASE_WEIGHT_VARIABLE: {
          if ((record = popString()) == null) return null;
          state = STATE_TAG;
          continue;
        }
        case STATE_VARIABLE: {
          if ((record = popVariable()) == null) return null;
          state = STATE_TAG;
          variables.push(record);
          continue;
        }
        case STATE_FIRST_DATUM: {
          state = STATE_DATA;
          return variables.map(function(v) { return v.name; });
        }
        case STATE_DATA: {
          if ((record = popData()) == null) return null;
          return record;
        }
        default: throw new Error("not implemented");
      }
    }
  }

  function popData() {
    var record;
    while (dataOffset < variableIndex) {
      if ((record = (variables[dataOffset].width ? popString : popFloat)()) == null) return null;
      ++dataOffset;
      data.push(record);
    }
    var oldData = data;
    dataOffset = 0;
    data = [];
    return oldData;
  }

  function popVariable() {
    var record;
    while (true) {
      switch (variableState) {
        case VARIABLE_STATE_WIDTH: {
          if ((variableWidth = popInteger()) == null) return null;
          variableState = VARIABLE_STATE_NAME;
          break;
        }
        case VARIABLE_STATE_NAME: {
          if ((variableName = popString()) == null) return null;
          variableState = VARIABLE_STATE_PRINT_FORMAT_TYPE;
          break;
        }
        case VARIABLE_STATE_PRINT_FORMAT_TYPE: {
          if ((variablePrintFormatType = popInteger()) == null) return null;
          variableState = VARIABLE_STATE_PRINT_FORMAT_WIDTH;
          break;
        }
        case VARIABLE_STATE_PRINT_FORMAT_WIDTH: {
          if ((variablePrintFormatWidth = popInteger()) == null) return null;
          variableState = VARIABLE_STATE_PRINT_FORMAT_PRECISION;
          break;
        }
        case VARIABLE_STATE_PRINT_FORMAT_PRECISION: {
          if ((variablePrintFormatPrecision = popInteger()) == null) return null;
          variableState = VARIABLE_STATE_WRITE_FORMAT_TYPE;
          break;
        }
        case VARIABLE_STATE_WRITE_FORMAT_TYPE: {
          if ((variableWriteFormatType = popInteger()) == null) return null;
          variableState = VARIABLE_STATE_WRITE_FORMAT_WIDTH;
          break;
        }
        case VARIABLE_STATE_WRITE_FORMAT_WIDTH: {
          if ((variableWriteFormatWidth = popInteger()) == null) return null;
          variableState = VARIABLE_STATE_WRITE_FORMAT_PRECISION;
          break;
        }
        case VARIABLE_STATE_WRITE_FORMAT_PRECISION: {
          if ((variableWriteFormatPrecision = popInteger()) == null) return null;
          variableState = VARIABLE_STATE_TAG;
          break;
        }
        case VARIABLE_STATE_TAG: {
          if ((record = popFixed(1)) == null) return null;
          variableState = VARIABLE_STATE_BY_TAG[record.toString(encoding)];
          if (!variableState) {
            variableState = VARIABLE_STATE_END;
            state = STATE_BY_TAG[record.toString(encoding)];
          }
          break;
        }
        case VARIABLE_STATE_MISSING_VALUE: {
          if ((record = (variableWidth ? popString : popFloat)()) == null) return null;
          variableMissingValues.push(record);
          variableState = VARIABLE_STATE_TAG;
          break;
        }
        case VARIABLE_STATE_MISSING_VALUE_RANGE_LO: {
          if ((record = (variableWidth ? popString : popFloat)()) == null) return null;
          variableMissingValueRange = [record, null];
          variableState = VARIABLE_STATE_MISSING_VALUE_RANGE_HI;
          break;
        }
        case VARIABLE_STATE_MISSING_VALUE_RANGE_HI: {
          if ((record = (variableWidth ? popString : popFloat)()) == null) return null;
          variableMissingValueRange[1] = record;
          variableState = VARIABLE_STATE_TAG;
          break;
        }
        case VARIABLE_STATE_LABEL: {
          if ((variableLabel = popString()) == null) return null;
          variableState = VARIABLE_STATE_END;
          state = STATE_TAG;
          break;
        }
        case VARIABLE_STATE_END: {
          variableState = VARIABLE_STATE_WIDTH;
          var variable = {
            type: "variable",
            index: variableIndex++,
            width: variableWidth,
            name: variableName,
            label: variableLabel,
            printFormat: {
              type: variablePrintFormatType,
              width: variablePrintFormatWidth,
              precision: variablePrintFormatPrecision
            },
            writeFormat: {
              type: variableWriteFormatType,
              width: variableWriteFormatWidth,
              precision: variableWriteFormatPrecision
            },
            missingValues: variableMissingValues,
            missingValueRange: variableMissingValueRange
          };
          variableLabel = null;
          variableMissingValues = [];
          variableMissingValueRange = null;
          return variable;
        }
        default: throw new Error("not implemented");
      }
    }
  }

  function popLine() {
    var newLine = lineParser.pop();
    if (newLine == null) return null;
    line = Buffer.concat([line, newLine]); // slow, but shouldn’t care
    lineLength += newLine.length;
    return line;
  }

  function popFixed(length) {
    while (length > lineLength) if (popLine() == null) return null;
    var oldLine = line.slice(0, length);
    line = line.slice(length);
    lineLength -= length;
    return oldLine;
  }

  function popField() {
    while (true) {
      if (fieldLength >= lineLength) if (popLine() == null) return null;
      var code = line[fieldLength++];
      if (code === CODE_FORWARD_SLASH) {
        fieldState = FIELD_STATE_DEFAULT;
        break;
      }
      if (code === CODE_ASTERISK) {
        fieldState = FIELD_STATE_AFTER_ASTERISK;
        continue;
      }
      if (fieldState == FIELD_STATE_AFTER_ASTERISK) {
        fieldState = FIELD_STATE_DEFAULT;
        break;
      }
    }
    var oldLine = line.slice(0, fieldLength - 1);
    lineLength -= fieldLength;
    line = line.slice(fieldLength);
    fieldLength = 0;
    return oldLine;
  }

  // TODO support fractions
  // TODO support exponent
  function popFloat() {
    return popInteger();
  }

  // TODO support exponent
  function popInteger() {
    var field = popField();
    if (field == null) return null;
    var i = -1, n = field.length;
    while (++i < n && field[i] === CODE_SPACE);
    if (field[i] === CODE_ASTERISK) return NaN;
    return parseInt(field.toString(encoding, i), 30);
  }

  function popString() {
    if (stringState === STRING_STATE_AFTER_LENGTH) {
      var string = popFixed(stringLength);
      if (string == null) return null;
      stringState = STRING_STATE_DEFAULT;
      return string.toString(encoding);
    }
    stringLength = popInteger();
    if (stringLength == null) return null;
    stringState = STRING_STATE_AFTER_LENGTH;
    return popString();
  }

  return parser;
}
