---
layout: default
title: Dev Log
---

<a id="toc"></a>
# Dev Log

{% assign logs = site.pages
  | where_exp: "p", "p.url contains '/dev-log/'"
  | where_exp: "p", "p.url != '/dev-log/'"
  | sort: "date"
  | reverse
%}

<ul class="list">
{% for p in logs %}
  <li>
    <span class="badge">{{ p.date | date: "%Y-%m-%d" }}</span>
    <a href="{{ p.url | relative_url }}">{{ p.title | default: p.name }}</a>
  </li>
{% endfor %}
</ul>

[↑ Back to TOC](#toc)
