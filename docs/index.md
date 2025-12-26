---
layout: default
title: Home
---

<a id="toc"></a>
# Dev Log / Specs

- [Dev Log]({{ '/dev-log/' | relative_url }})
- [Specs]({{ '/specs/' | relative_url }})

## Latest Dev Logs

{% assign logs = site.pages
  | where_exp: "p", "p.url contains '/dev-log/'"
  | where_exp: "p", "p.url != '/dev-log/'"
  | sort: "date"
  | reverse
%}

<ul class="list">
{% for p in logs limit: 10 %}
  <li>
    <span class="badge">{{ p.date | date: "%Y-%m-%d" }}</span>
    <a href="{{ p.url | relative_url }}">{{ p.title | default: p.url }}</a>
  </li>
{% endfor %}
</ul>
