-- send client-side scripts
AddCSLuaFile("bonchat/resources/chatbox.html.lua")
AddCSLuaFile("bonchat/resources/emojis.json.lua")
AddCSLuaFile("bonchat/vgui/frame.lua")
AddCSLuaFile("bonchat/vgui/settings.lua")
AddCSLuaFile("bonchat/vgui/chatbox.lua")
AddCSLuaFile("bonchat/vgui/browser.lua")

util.AddNetworkString("BonChat_say")

net.Receive("BonChat_say", function(len, ply)
  -- check message send cooldown
  if ply.lastMsgTime and CurTime() - ply.lastMsgTime < BonChat.GetMsgCooldown() then return end

  local text = string.Left(net.ReadString(), BonChat.GetMsgMaxLen())
  local isTeam = net.ReadBool()

  text = hook.Run("PlayerSay", ply, text, isTeam)

  if text ~= "" then
    net.Start("BonChat_say")
      net.WriteEntity(ply)
      net.WriteString(text)
      net.WriteBool(isTeam)
    if IsValid(ply) and isTeam then
      net.Send(team.GetPlayers(ply:Team()))
    else
      net.Broadcast()
    end
    ply.lastMsgTime = CurTime()
  end
end)