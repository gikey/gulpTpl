location / {
	alias /opt/src/app/;
    expires 24h;
}
{% for p in proxys %}
location ^~ /{{ p.pathRewrite }}/ {
    proxy_set_header Host {{ p.host }};
    proxy_set_header Origin http://{{ p.host }};
    proxy_pass    http://{{ p.host }}/;
}
{% endfor %}

