---
layout: default
title: Dev Log
---

# Dev Log

{% assign logs = site.pages
  | where_exp: "p", "p.url contains '/dev-log/'"
  | where_exp: "p", "p.url != '/dev-log/'"
  | sort: "date"
  | reverse
%}

{% if logs.size == 0 %}
まだログがありません。
{% else %}
<ul>
{% for p in logs %}
  <li>
    <a href="{{ p.url | relative_url }}">{{ p.title | default: p.name }}</a>
    {% if p.date %}<span style="color:#666; font-size:12px;">（{{ p.date | date: "%Y-%m-%d" }}）</span>{% endif %}
  </li>
{% endfor %}
</ul>
{% endif %}
