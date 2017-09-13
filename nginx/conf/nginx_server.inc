location / {
	alias /opt/src/app/;
    expires 24h;
}

location ^~ /api/ {
    proxy_set_header Host {{ host }};
    proxy_set_header Origin http://{{ host }};
    proxy_pass    http://{{ host }}/;
}
