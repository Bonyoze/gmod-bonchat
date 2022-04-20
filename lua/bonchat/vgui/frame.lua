include("bonchat/vgui/settings.lua")
include("bonchat/vgui/chatbox.lua")
include("bonchat/vgui/browser.lua")

local optionClasses = {
  contentCentered = "center-content",
  attachmentsCentered = "center-attachments",
  contentUnselectable = "unselect-content",
  attachmentsUnselectable = "unselect-attachments",
  contentUntouchable = "untouch-content",
  attachmentsUntouchable = "untouch-attachments",
  timestampShown = "show-timestamp"
}

local PANEL = {
  Init = function(self)
    self:SetSize(ScrW() * 0.25, ScrH() * 0.5)
    self:SetPos(ScrW() * 0.02, (ScrH() - self:GetTall()) - ScrH() * 0.115)
    self:SetMinWidth(self:GetWide())
    self:SetMinHeight(self:GetTall())
    self:SetTitle("")
    self:ShowCloseButton(false)
    self:SetSizable(true)
    self:SetScreenLock(true)

    -- paint function used when the chat is open
    self.openPaint = function(self, w, h)
      self:DrawBlur(1, 1)
      surface.SetDrawColor(30, 30, 30)
      surface.DrawOutlinedRect(0, 0, w, h, 2)
      surface.DrawRect(0, 0, w, 25)
    end

    self.settings = self:Add("BonChat_Settings")

    self.btnSettings = self:Add("DButton")
    self.btnSettings:SetSize(20, 20)
    self.btnSettings:SetText("")
    self.btnSettings:SetPos(self:GetWide() - 24, 3)
    self.btnSettings:SetImage("icon16/cog.png")
    self.btnSettings.Paint = function() end
    self.btnSettings.DoClick = function() -- toggle settings panel visibility
      if self.settings:IsVisible() then return self.settings:Hide() end
      local x, y = self:LocalToScreen()
      self.settings:SetSize(ScrW() * 0.15, self:GetTall())
      self.settings:SetPos(x + self:GetWide() + 4, y)
      self.settings:Show()
      self.settings:MakePopup()
    end

    -- DHTML panel used for the actual chatbox
    self.chatbox = self:Add("BonChat_Chatbox")

    -- DFrame panel used for opening links in-game
    self.browser = vgui.Create("BonChat_Browser")

    -- fix scale of children on resize
    self.OnSizeChanged = function(self, w, h)
      self.settings:SetSize(ScrW() * 0.15, self:GetTall())
    end

    local lastEnter = false
    local lastEscape = false

    hook.Add("Think", self, function()
      if not self:IsKeyboardInputEnabled() then return end

      -- update position of children

      self.btnSettings:SetPos(self:GetWide() - 24, 3)

      if self.settings:IsVisible() then
        self.settings:SetPos(self:GetX() + self:GetWide() + 4, self:GetY())
      end

      -- listen for enter and escape key

      local enter = input.IsKeyDown(KEY_ENTER)
      local escape = input.IsKeyDown(KEY_ESCAPE)

      if not lastEnter and enter then -- on enter press, submit message and close chatbox
        -- we can't directly get the value, so we call a function with a lua callback
        self:CallJS("glua.say(entry.text())")
        BonChat.CloseChat()
      elseif not lastEscape and escape then -- on escape press, close the chatbox
        BonChat.CloseChat()
      end

      lastEnter = enter
      lastEscape = escape
    end)

    hook.Add("ChatText", self, function(self, _, _, text, type)
      self:AppendMessage({}, text)
    end)

    local clrTeam = Color(24, 162, 35)

    hook.Add("OnPlayerChat", self, function()
      self:SetMessageOptions({ timestampShown = true }) // set options for next appended message
    end)

    self:CloseFrame()
  end,
  CallJS = function(self, str, ...)
    self.chatbox:Call("(function() {" .. string.format(str, ...) .. "})()")
  end,
  tempJS = "",
  ReadyJS = function(self)
    tempJS = ""
  end,
  AddJS = function(self, str, ...)
    str = string.Trim(str)
    if str[#str] ~= ";" then
      str = str .. ";"
    end
    tempJS = tempJS .. string.format(str, ...)
  end,
  RunJS = function(self)
    self:CallJS(tempJS)
    self:ReadyJS()
  end,
  SetMessageOptions = function(self, options)
    self.msgOptions = istable(options) and options
  end,
  AppendMessage = function(self, options, ...)
    self:ReadyJS()

    -- create a new message object
    self:AddJS("var msg = new Message()")

    -- apply options

    if self.msgOptions then
      table.Merge(options, self.msgOptions)
      self.msgOptions = nil
    end

    for k, v in pairs(options) do
      if v ~= true then continue end
      local opt = optionClasses[k]
      if opt then self:AddJS("msg.MSG_CONTAINER.addClass('%s')", opt) end
    end

    if options.sender then
      if IsValid(options.sender) then
        self:AddJS("msg.MSG_CONTAINER.data('sender', '%s')", options.sender:SteamID())
      else
        self:AddJS("msg.MSG_CONTAINER.data('sender', null)")
      end
    end

    -- add the message components
    for _, v in ipairs({...}) do
      if isstring(v) then
        self:AddJS("msg.appendMarkdownText('%s')", string.JavascriptSafe(v))
      elseif istable(v) then
        -- set the current text color
        self:AddJS("msg.setTextColor('rgb(%d,%d,%d)')",
          isnumber(v.r) and v.r % 256 or 255,
          isnumber(v.g) and v.g % 256 or 255,
          isnumber(v.b) and v.b % 256 or 255
        );
      elseif isentity(v) then
        if v == NULL then
          self:AddJS("msg.appendText('NULL')")
        elseif v:IsPlayer() then
          local clr = hook.Run("GetTeamColor", v)
          self:AddJS("msg.appendPlayerName('%s', '%s', '%s')",
            string.JavascriptSafe(v:Nick()),
            "rgb(" .. clr.r .. "," .. clr.g .. "," .. clr.b .. ")",
            string.JavascriptSafe(v:SteamID())
          )
        else
          self:AddJS("msg.appendText('%s')", string.JavascriptSafe(v:GetClass()))
        end
      end
    end

    -- send the message element to the chatbox
    self:AddJS("msg.send()")
    self:RunJS()
  end,
  OpenFrame = function(self)
    -- move the frame to the front and enable input
    self:MakePopup()

    -- start painting frame
    self.Paint = self.openPaint

    -- show parts
    self.btnSettings:Show()

    -- need to request focus so the client can type in it
    self.chatbox:RequestFocus()

    self:CallJS("CHATBOX_PANEL_OPEN()")
  end,
  CloseFrame = function(self)
    -- stop the chatbox panel from drawing over other panels (like the game menu)
    self:MoveToBack()

    -- disable any input to the frame
    self:SetKeyBoardInputEnabled(false)
    self:SetMouseInputEnabled(false)

    -- stop painting the frame
    self.Paint = function() end

    -- hide parts
    self.settings:Hide()
    self.btnSettings:Hide()
    self.browser:Hide()

    self:CallJS("CHATBOX_PANEL_CLOSE()")
  end,
  OnRemove = function(self)
    -- cleanup
    self.browser:Remove()
  end
}

vgui.Register("BonChat_Frame", PANEL, "DFrame")