var FORMAT_ONELINE   = 'One-line';
var FORMAT_MULTILINE = 'Multi-line';
var FORMAT_PRETTY    = 'Pretty';

var LANGUAGE_IOS      = 'iOS';
var LANGUAGE_ANDROID  = 'Android';

/* 
   The script expects two columns for iOS and Android identifiers, respectively,
   and a column after that with all of the string values. This is the position of
   the iOS column.
*/
var FIRST_COLUMN_POSITION = 2

var STRUCTURE_LIST = 'List';
var STRUCTURE_HASH = 'Hash (keyed by "id" column)';

/* Defaults for this particular spreadsheet, change as desired */
var DEFAULT_FORMAT = FORMAT_PRETTY;
var DEFAULT_LANGUAGE = LANGUAGE_IOS;
var DEFAULT_STRUCTURE = STRUCTURE_LIST;

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  // Or DocumentApp or FormApp.
  ui.createMenu('Custom Export')
      .addItem('iOS', 'exportForIos')
      .addItem('Android', 'exportForAndroid')
      .addToUi();
}

function exportForIos() {
  var e = {
    parameter: {
      language: LANGUAGE_IOS
    }
  };
  exportSheet(e);
}

function exportForAndroid() {
  var e = {
    parameter: {
      language: LANGUAGE_ANDROID
    }
  };
  exportSheet(e);
}

function exportSheet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var rowsData = getRowsData_(sheet, getExportOptions(e));
  var json = makeStrings(rowsData, getExportOptions(e));
  return displayText_(json);
}

function getExportOptions(e) {
  var options = {};
  
  options.language = e && e.parameter.language || DEFAULT_LANGUAGE;
  options.format   = e && e.parameter.format || DEFAULT_FORMAT;
  options.structure = e && e.parameter.structure || DEFAULT_STRUCTURE;
  
  var cache = CacheService.getPublicCache();
  cache.put('language', options.language);
  cache.put('format',   options.format);
  cache.put('structure',   options.structure);
  
  Logger.log(options);
  return options;
}

function makeLabel(app, text, id) {
  var lb = app.createLabel(text);
  if (id) lb.setId(id);
  return lb;
}

function makeListBox(app, name, items) {
  var listBox = app.createListBox().setId(name).setName(name);
  listBox.setVisibleItemCount(1);
  
  var cache = CacheService.getPublicCache();
  var selectedValue = cache.get(name);
  Logger.log(selectedValue);
  for (var i = 0; i < items.length; i++) {
    listBox.addItem(items[i]);
    if (items[1] == selectedValue) {
      listBox.setSelectedIndex(i);
    }
  }
  return listBox;
}

function makeButton(app, parent, name, callback) {
  var button = app.createButton(name);
  app.add(button);
  var handler = app.createServerClickHandler(callback).addCallbackElement(parent);;
  button.addClickHandler(handler);
  return button;
}

function makeTextBox(app, name) { 
  var textArea = app.createTextArea().setWidth('100%').setHeight('200px').setId(name).setName(name);
  return textArea;
}

function makeStrings(object, options) {
  
  switch (options.language) {
    case LANGUAGE_ANDROID:
      return makeAndroidStrings(object, options);
      break;
    case LANGUAGE_IOS:
      return makeIosStrings(object, options);
      break;
    default:
      break;
  }
  
  return "";
}

function makeAndroidStrings(object, options) {

  var exportString = "";
  var prevIdentifier = "";
  
  exportString = '<?xml version="1.0" encoding="UTF-8"?>' + "\n";
  exportString += "<resources>\n";
  
  for(var i=0; i<object.length; i++) {
    
    var o = object[i];
    var identifier = o.identifierAndroid;
    
    if(identifier == "") {
      continue;
    }
  
    if(identifier != prevIdentifier && prevIdentifier != "") {
      exportString += "\t" + '</string-array>' + "\n";
      prevIdentifier = "";
    }
    
    if(identifier.indexOf("[]")>0) {
      
      if(identifier != prevIdentifier) {
        exportString += "\t" + '<string-array name="' + identifier.substr(0,identifier.length-2) + '">' + "\n";
      }
      
      exportString += "\t\t"+'<item>'+o.text+'</item>' + "\n";
      prevIdentifier = identifier;
      
    } else {
      exportString += "\t"+'<string name="'+identifier+'">'+o.text+'</string>' + "\n";
    }
  }
  
  exportString += "</resources>";
  
  return exportString;
}

function makeIosStrings(object, options) {

  var exportString = "";
  var prevIdentifier = "";
  
  exportString += "// MARK: - Localizable enum\n\n"
  
  exportString += "enum Localizable {\n\n"
          
  for(var i=0; i<object.length; i++) {
        
    var o = object[i];
    var identifier = o.identifierIos;
      
    if (identifier == "") {
      continue;
    }
        
    exportString += "    /// " + o.text + "\n";
    exportString += "    static let " + identifier + " = \"" + identifier + "\"\n\n";
  }
    
  exportString += "// MARK: - Strings\n\n";
  
  for(var i=0; i<object.length; i++) {
    var o = object[i];
    var identifier = o.identifierIos;
    
    if(identifier == "") {
      continue;
    }
    
    exportString += '"' + identifier + '" = "' + o.text + "\";\n";
  }
  
  return exportString;
}

function displayText_(text) {
  var app = UiApp.createApplication().setTitle('Export');
  app.add(makeTextBox(app, 'json'));
  app.getElementById('json').setText(text);
  var ss = SpreadsheetApp.getActiveSpreadsheet(); 
  ss.show(app);
  return app; 
}

function getRowsData_(sheet, options) {
  
  var headersRange = sheet.getRange(1, FIRST_COLUMN_POSITION, sheet.getFrozenRows(), sheet.getMaxColumns());
  var headers = headersRange.getValues()[0];
  var dataRange = sheet.getRange(sheet.getFrozenRows()+1, FIRST_COLUMN_POSITION, sheet.getMaxRows(), sheet.getMaxColumns());
  var objects = getObjects_(dataRange.getValues(), normalizeHeaders_(headers));
  
  return objects;
}

function getObjects_(data, keys) {
  var objects = [];
  for (var i = 0; i < data.length; ++i) {
    var object = {};
    var hasData = false;
    for (var j = 0; j < data[i].length; ++j) {
      var cellData = data[i][j];
      if (isCellEmpty_(cellData)) {
        //continue;
        cellData = "";
      }
      object[keys[j]] = cellData;
      hasData = true;
    }
    if (hasData) {
      objects.push(object);
    }
  }
  return objects;
}


function normalizeHeaders_(headers) {
  var keys = [];
  for (var i = 0; i < headers.length; ++i) {
    var key = normalizeHeader_(headers[i]);
    if (key.length > 0) {
      keys.push(key);
    }
  }
  return keys;
}

function normalizeHeader_(header) {
  var key = "";
  var upperCase = false;
  for (var i = 0; i < header.length; ++i) {
    var letter = header[i];
    if (letter == " " && key.length > 0) {
      upperCase = true;
      continue;
    }
    if (!isAlnum_(letter)) {
      continue;
    }
    if (key.length == 0 && isDigit_(letter)) {
      continue; // first character must be a letter
    }
    if (upperCase) {
      upperCase = false;
      key += letter.toUpperCase();
    } else {
      key += letter.toLowerCase();
    }
  }
  return key;
}


// Returns true if the cell where cellData was read from is empty.
// Arguments:
//   - cellData: string
function isCellEmpty_(cellData) {
  return typeof(cellData) == "string" && cellData == "";
}

// Returns true if the character char is alphabetical, false otherwise.
function isAlnum_(char) {
  return char >= 'A' && char <= 'Z' ||
    char >= 'a' && char <= 'z' ||
    isDigit_(char);
}

// Returns true if the character char is a digit, false otherwise.
function isDigit_(char) {
  return char >= '0' && char <= '9';
}

// Given a JavaScript 2d Array, this function returns the transposed table.
// Arguments:
//   - data: JavaScript 2d Array
// Returns a JavaScript 2d Array
// Example: arrayTranspose([[1,2,3],[4,5,6]]) returns [[1,4],[2,5],[3,6]].
function arrayTranspose_(data) {
  if (data.length == 0 || data[0].length == 0) {
    return null;
  }

  var ret = [];
  for (var i = 0; i < data[0].length; ++i) {
    ret.push([]);
  }

  for (var i = 0; i < data.length; ++i) {
    for (var j = 0; j < data[i].length; ++j) {
      ret[j][i] = data[i][j];
    }
  }

  return ret;
}
