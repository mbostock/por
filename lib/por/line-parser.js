var CODE_LINE_FEED = "\n".charCodeAt(0),
    CODE_CARRIAGE_RETURN = "\r".charCodeAt(0);

var STATES = 0,
    STATE_DEFAULT = ++STATES,
    STATE_MAYBE_LINE = ++STATES,
    STATE_AFTER_LINE = ++STATES;

// Parses a .por file into 80-byte lines, separated by \r\n.
module.exports = function() {
  var parser = {
        push: parser_push,
        pop: parser_pop
      },
      buffer = new Buffer(0),
      bufferOffset = 0,
      bufferLength = 0,
      state = STATE_DEFAULT,
      fragment = null;

  function parser_push(data) {
    if (bufferOffset < bufferLength) throw new Error("cannot push before all lines are popped");
    bufferLength = data.length;
    bufferOffset = 0;
    buffer = data;
  }

  function parser_pop() {
    var oldBufferOffset = bufferOffset;

    // Find the next line terminator.
    while (bufferOffset < bufferLength) {
      var code = buffer[bufferOffset++];
      if (state === STATE_MAYBE_LINE) {
        if (code === CODE_LINE_FEED) {
          state = STATE_AFTER_LINE;
          break;
        }
        state = STATE_DEFAULT; // ignore bare \r
      }
      if (code === CODE_LINE_FEED) {
        state = STATE_AFTER_LINE_FEED;
        break;
      }
      if (code === CODE_CARRIAGE_RETURN) {
        state = STATE_MAYBE_LINE;
        continue;
      }
    }

    // Slice out the new data.
    var newFragment = buffer.slice(oldBufferOffset, bufferOffset);

    // Combine it with the old data, if any.
    if (fragment != null) {
      var oldFragment = newFragment;
      newFragment = new Buffer(fragment.length + oldFragment.length);
      fragment.copy(newFragment);
      oldFragment.copy(newFragment, fragment.length);
      fragment = null;
    }

    // We read a line! Slice off the \r\n.
    if (state === STATE_AFTER_LINE) {
      state = STATE_DEFAULT;
      newFragment = newFragment.slice(0, -2)

      // Pad the line with spaces, if not 80 characters.
      if (newFragment.length < 80) {
        var oldFragment = newFragment;
        newFragment = new Buffer(80);
        oldFragment.copy(newFragment);
        newFragment.fill(32, oldFragment.length);
      }

      return newFragment;
    }

    // Otherwise, we’ve read part of a line. Copy the fragment so that the
    // source buffer can be modified without changing the fragment contents.
    fragment = new Buffer(newFragment.length);
    newFragment.copy(fragment);
    return null;
  }

  return parser;
};
