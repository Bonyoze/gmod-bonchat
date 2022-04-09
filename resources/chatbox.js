const WHITELIST_PROTOCOLS = [
  "https",
  "http"
],
WHITELIST_DOMAINS = [
  // Steam
  "cdn.akamai.steamstatic.com",
  // Discord
  "cdn.discordapp.com",
  "media.discordapp.net",
  // Twitter
  "pbs.twimg.com",
  // Dropbox
  "www.dropbox.com",
  "dl.dropboxusercontent.com",
  // Imgur
  "i.imgur.com",
  // Tenor
  "tenor.com"
],
WHITELIST_FORMATS = [
  "png",
  "jpg", "jpeg",
  "gif",
  "mp4",
  "webm",
  "ogg",
  "mp3",
  "wav"
],
SANITIZE_TEXT_REGEX = /[<>&"'/`]/g,
SANITIZE_TEXT_CODES = {
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
    "`": "&#96;"
};

function sanitizeText(text) {
  return text.replace(SANITIZE_TEXT_REGEX, function(char) {
    return SANITIZE_TEXT_CODES[char];
  });
}

function isWhitelistedURL(href) {
  var url = document.createElement("a");
  url.href = href;

  var protocol = url.protocol.slice(0, -1),
  domain = url.hostname + url.pathname,
  format = url.pathname.split("/");
  format = format[format.length - 1].split(".");
  format = format[format.length - 1];

  return WHITELIST_PROTOCOLS.some(function(x) { return x == protocol; })
    && WHITELIST_DOMAINS.some(function(x) { return domain.substring(0, x.length) == x; })
    && WHITELIST_FORMATS.some(function(x) { return x == format; });
}

function sanitizeURL(url) {
  if (url == null) return null;
  try {
    var prot = decodeURIComponent(url)
      .replace(/[^A-Za-z0-9/:]/g, "")
      .toLowerCase();
    if (prot.indexOf("javascript:") === 0
      || prot.indexOf("vbscript:") === 0
      || prot.indexOf("data:") === 0
    ) return null;
  } catch (e) {
    return null;
  }
  return url;
};

function htmlTag(tagName, content, attributes, isClosed) {
  attributes = attributes || {};
  isClosed = typeof isClosed !== "undefined" ? isClosed : true;

  var attributeString = "";
  for (var attr in attributes) {
    var attribute = attributes[attr];
    // removes falsey attributes
    if (Object.prototype.hasOwnProperty.call(attributes, attr) && attribute) {
      attributeString += " " +
        sanitizeText(attr) + '="' +
        sanitizeText(attribute) + '"';
      }
  }

  var unclosedTag = "<" + tagName + attributeString + ">";

  if (isClosed) {
    return unclosedTag + content + "</" + tagName + ">";
  } else {
    return unclosedTag;
  }
};

const rules = {
  escape: {
    match: /^\\([^0-9A-Za-z\s])/,
    parse: function(capture) {
      return {
        type: "text",
        content: capture[1]
      };
    },
    html: null
  },
  spoiler: {
    match: /^\|\|([\s\S]+?)\|\|/,
    parse: function(capture, parse) {
      return {
        content: parse(capture[1])
      };
    },
    html: function(node, output) {
      return htmlTag("span", htmlTag("span", output(node.content)), { class: "spoiler" });
    }
  },
  autolink: {
    match: /^<([^:\s>]+:\/\/[^\s>]+)>/,
    parse: function(capture) {
      return {
        content: capture[1]
      }
    },
    html: function(node) {
      return htmlTag("a", node.content, { class: "link", href: sanitizeURL(node.content) });
    }
  },
  url: {
    match: /^([^:\s]+:\/\/\S+)/,
    parse: function(capture) {
      return {
        content: capture[1]
      };
    },
    html: function(node) {
      return htmlTag("a", node.content, { class: "link", href: sanitizeURL(node.content) });
    }
  },
  em: {
    match: /^\b_((?:__|\\[\s\S]|[^\\_])+?)_\b|^\*(?=\S)((?:\*\*|\\[\s\S]|\s+(?:\\[\s\S]|[^\s\*\\]|\*\*)|[^\s\*\\])+?)\*(?!\*)/,
    parse: function(capture, parse) {
      return {
        content: parse(capture[2] || capture[1])
      };
    },
    html: function(node, output) {
      return htmlTag("em", output(node.content));
    }
  },
  strong: {
    match: /^\*\*((?:\\[\s\S]|[^\\])+?)\*\*(?!\*)/,
    parse: function(capture, parse) {
      return {
        content: parse(capture[1])
      }
    },
    html: function(node, output) {
      return htmlTag("strong", output(node.content));
    }
  },
  u: {
    match: /^__((?:\\[\s\S]|[^\\])+?)__(?!_)/,
    parse: function(capture, parse) {
      return {
        content: parse(capture[1])
      }
    },
    html: function(node, output) {
      return htmlTag("u", output(node.content));
    }
  },
  strike: {
    match: /^~~([\s\S]+?)~~(?!_)/,
    parse: function(capture, parse) {
      return {
        content: parse(capture[1])
      };
    },
    html: function(node, output) {
      return htmlTag("del", output(node.content));
    }
  },
  /*twemoji_emoji: {
    match: /^
  },
  discord_emoji: {
    match: /^<(a?):(\w+):(\d+)>/,
    parse: function(capture) {
      return {
        animated: capture[1] == "a",
        name: capture[2],
        id: capture[3]
      };
    },
    html: function(node) {
      return htmlTag("img", "", {
        class: "emoji",
        src: "https://cdn.discordapp.com/emojis/" + node.id + "." + (node.animated ? "gif" : "png"),
        alt: ":" + node.name + ":"
      });
    }
  },*/
  color: {
    match: /^\$([a-z0-9]+)/i,
    parse: function(capture) {
      return {
        content: capture[1]
      };
    },
    html: function(node) {
      if (/^([0-9a-f]{6}|[0-9a-f]{3})$/i.test(node.content))
        return htmlTag("font", null, { color: "#" + node.content }, false);
      else {
        var s = new Option().style;
        s.color = node.content;
        if (s.color !== "")
          return htmlTag("font", null, { color: node.content }, false);
        else
          return "$" + node.content;
      }
    }
  },
  br: {
    match: /^\n/,
    parse: function() {
      return;
    },
    html: function() {
      return "<br>";
    }
  },
  text: {
    match: /^[\s\S]+?(?=[^0-9A-Za-z\s\u00c0-\uffff-]|\n\n|\n|\w+:\S|$)/,
    parse: function(capture) {
      return {
        content: capture[0]
      }
    },
    html: function(node) {
      return sanitizeText(node.content);
    }
  }
},
ruleList = Object.keys(rules);

function nestedParse(source) {
  var result = [];

  while (source) {
    var ruleType = null,
    rule = null,
    capture = null;

    var i = 0;
    var currRuleType = ruleList[0]
    var currRule = rules[currRuleType];

    do {
      var currCapture = currRule.match.exec(source);

      if (currCapture) {
        ruleType = currRuleType;
        rule = currRule;
        capture = currCapture;
      }
      
      i++
      currRuleType = ruleList[i];
      currRule = rules[currRuleType];
    } while (currRule && !capture);
    
    if (rule == null || capture == null) throw new Error("Could not find a matching rule");
    if (capture.index) throw new Error("'match' must return a capture starting at index 0");

    var parsed = rule.parse(capture, nestedParse)

    if (Array.isArray(parsed)) {
      Array.prototype.push.apply(result, parsed);
    } else {
      if (parsed.type == null) parsed.type = ruleType;
      result.push(parsed);
    }

    source = source.substring(capture[0].length);
  }

  return result;
}

function outputHTML(ast) {
  if (Array.isArray(ast)) {
    var result = "";

    // map output over the ast, except group any text
    // nodes together into a single string output.
    for (var i = 0; i < ast.length; i++) {
      var node = ast[i];
      if (node.type === "text") {
        node = { type: "text", content: node.content };
        for (; i + 1 < ast.length && ast[i + 1].type === "text"; i++) {
          node.content += ast[i + 1].content;
        }
      }

      result += outputHTML(node);
    }

    return result;
  } else {
    return rules[ast.type].html(ast, outputHTML);
  }
}

const chatbox = $("#chatbox"),
entry = $("#entry");

var msgMaxLen = 2048;
var tempMsg;

function isFullyScrolled() {
  var e = chatbox.get(0);
  return Math.abs(e.scrollHeight - e.clientHeight - e.scrollTop) < 1;
}

function scrollToBottom() {
  var e = chatbox.get(0);
  e.scrollTop = e.scrollHeight;
}

function getMessageByID(id) {
  return $(".message[message-id='" + id + "']");
}

var msgID = 0;

function Message() {
  this.elem = $("<div class='message'>");
  this.textColor = "#97d3ff"; // this is the default text color
  this.setTextColor = function(str) {
    if (str) this.textColor = str;
  };
  this.appendText = function(str) {
    var markdownHTML = outputHTML(nestedParse(str));
    this.elem.append(
      $("<span>")
        .html(markdownHTML)
        .css("color", this.textColor)
     );
  };
  this.send = function() {
    var id = msgID++;
    this.elem.attr("message-id", id);

    twemoji.parse(this.elem.get(0), {
      folder: "svg",
      ext: ".svg"
    });

    var scrolled = isFullyScrolled();
    this.elem.appendTo(chatbox);
    if (scrolled) scrollToBottom();

    this.elem.find("a").each(function() {
      var a = $(this),
      url = a.attr("href");
      if (url && isWhitelistedURL(url)) {
        checkImageContent(url, function() { // check if content from url can be displayed using an image
          a
            .attr("class", "attachment")
            .html($("<img>").attr("src", url))
            .appendTo(a.parent());
        });
      }
    });
  }
}

function checkImageContent(src, success, fail) {
  var e = $("<img>");
  e.on("load", success);
  e.on("error", fail);
  e.attr("src", src);
}

/*function checkVideoContent(src, success, fail) {
  var e = $("<video>");
  console.log("testing video")
  e.on("loadedmetadata", function() {
    console.log("test2")
    if (e.prop("videoHeight") && e.prop("videoWidth"))
      success();
    else {
      console.log("test3")
      fail();
    }
  });
  e.on("error", fail);
  e.append($("<source>").attr("src", src));
  e.prop("preload", "metadata");
  //e.get(0).play();
}

function checkAudioContent(src, success, fail) {
  var e = $("<audio>");
  console.log("testing audio")
  e.prop("preload", "metadata");
  e.on("loadedmetadata", function() {
    console.log("" + e.get(0).duration)
    success();
  });
  e.on("error", fail);
  e.attr("src", src);
}*/

entry
  .on("keypress", function(e) {
    // prevent newlines and exceeding the char limit
    return !e.which != 13 && !e.ctrlKey && !e.metaKey && !e.altKey && e.which != 8 && entry.text().length < msgMaxLen;
  })
  .on("paste", function(e) {
    // prevent pasting html or newlines into the entry
    e.preventDefault();
    var paste = e.originalEvent.clipboardData.getData("text/plain");
    if (paste && paste.length) {
      document.execCommand("insertText", false,
        paste
          .replace(/[\r\n]/g, "") // remove newlines
          .substring(0, msgMaxLen - entry.text().length + document.getSelection().toString().length) // make sure pasting it won't exceed the char limit);
      )
    }
  });

  // prevent page redirects and call lua function to open url
  $(document)
    .on("click", function(e) {
      var elem = $(e.target),
      url = elem.attr("href") || elem.parent().attr("href");
      if (url) {
        event.preventDefault();
        glua.openURL(url);
      }
    });