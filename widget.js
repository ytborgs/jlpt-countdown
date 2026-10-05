// JLPT N3 Home Screen widget for Scriptable.
// Countdown rolls over at midnight in Vietnam (UTC+7).
const exam = new Date("2026-12-06T00:00:00+07:00");
const day = 24 * 60 * 60 * 1000;
const remaining = Math.max(0, Math.ceil((exam.getTime() - Date.now()) / day));
const widget = new ListWidget();

widget.backgroundColor = new Color("#13243c");
widget.setPadding(17, 18, 17, 18);
widget.url = "https://ytborgs.github.io/jlpt-countdown/";

const title = widget.addText("JLPT  /  N3");
title.font = Font.boldSystemFont(12);
title.textColor = new Color("#eabb76");

widget.addSpacer();
const number = widget.addText(String(remaining));
number.font = Font.boldSystemFont(58);
number.textColor = new Color("#f5f2e9");
number.minimumScaleFactor = 0.7;
number.lineLimit = 1;

const label = widget.addText(remaining === 0 ? "HÔM NAY THI · 頑張って！" : "NGÀY CÒN LẠI");
label.font = Font.semiboldSystemFont(11);
label.textColor = new Color("#eabb76");

widget.addSpacer(8);
const date = widget.addText("06.12.2026  ·  日本語能力試験");
date.font = Font.mediumSystemFont(10);
date.textColor = new Color("#a9b6c8");
date.minimumScaleFactor = 0.7;
date.lineLimit = 1;

// Scriptable requests a refresh after the next Vietnam midnight.
// iOS controls the actual refresh time and may update later.
const nextMidnight = remaining > 0
  ? exam.getTime() - (remaining - 1) * day + 60 * 1000
  : Date.now() + day;
widget.refreshAfterDate = new Date(nextMidnight);

Script.setWidget(widget);
if (config.runsInApp) await widget.presentSmall();
Script.complete();
