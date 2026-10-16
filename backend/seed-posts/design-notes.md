---
title: 这个博客的设计思路
slug: design-notes
excerpt: 为什么是横向画廊 + 暖纸博客。
tags: 设计
status: published
---

## 首页：横向画廊

首页借鉴了 Rauno 式的横向画廊：BLOG / WORK / SITES 三个巨型主题词，一屏一个，点进去才是内容。手机端和桌面端是同一套布局等比缩放，没有单独的移动端排版。

## 博客区：暖纸风

文章列表和正文是暖纸编辑风：暖米色底、衬线标题、陶土橙点缀。长文阅读不累眼。

## 技术选择

- 前台零构建：HTML + CSS + 原生 JS，没有框架，没有打包步骤
- 后台单文件 Worker：Cloudflare Worker + D1，API 全部手写，不依赖 npm 包
- 配置与代码分离：个人信息全在 `config.js`，换个文件就是你的博客
