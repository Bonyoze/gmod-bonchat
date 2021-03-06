local PANEL = {
  Init = function(self)
    self.jsStr = ""
  end,
  CallJS = function(self, str)
    self:Call("(function() {" .. str .. "})()")
  end,
  CallJSParams = function(self, str, ...)
    self:Call("(function() {" .. string.format(str, ...) .. "})()")
  end,
  ReadyJS = function(self)
    self.jsStr = ""
  end,
  AddJS = function(self, str, ...)
    str = string.Trim(str)
    if str[#str] ~= ";" then
      str = str .. ";"
    end
    self.jsStr = self.jsStr .. string.format(str, ...)
  end,
  RunJS = function(self)
    self:CallJS(self.jsStr)
  end,
  AddFunc = function(self, name, func)
    self:AddFunction("glua", name, func)
  end
}

vgui.Register("BonChat_DHTML", PANEL, "DHTML")