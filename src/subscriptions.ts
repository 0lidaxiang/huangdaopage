import type { Site } from "./types";

export function subscriptionChannels(site: Site) {
  const settings = site.settings;
  const channels = [
    {
      id: "wechat",
      label: "微信公众号",
      account: settings.wechatName,
      qrCode: settings.qrCode,
      url: settings.wechatUrl || "",
      action: "打开公众号",
      hint: "每周精选与重要信号",
    },
  ];
  if (settings.xiaohongshuUrl || settings.xiaohongshuQrCode)
    channels.push({
      id: "xiaohongshu",
      label: "小红书",
      account: "关注小红书",
      qrCode: settings.xiaohongshuQrCode || "",
      url: settings.xiaohongshuUrl || "",
      action: "打开小红书",
      hint: "笔记与日常分享",
    });
  return channels;
}
