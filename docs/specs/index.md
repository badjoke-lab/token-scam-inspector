---
layout: default
title: Specs
---

<a id="toc"></a>
# Specs

{% assign specs = site.pages
  | where_exp: "p", "p.url contains '/specs/'"
  | where_exp: "p", "p.url != '/specs/'"
  | sort: "title"
%}

<ul class="list">
{% for p in specs %}
  <li>
    <a href="{{ p.url | relative_url }}">{{ p.title | default: p.name }}</a>
  </li>
{% endfor %}
</ul>

[↑ Back to TOC](#toc)

