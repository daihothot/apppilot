# AppPilot Websocket Protocol

## Flow

1. AppPilot starts a PC websocket server before launching the app.
2. AppPilot launches Unity with startup parameters:
   - `guru_ws_client_ip_port=<pc-ip>:<pc-port>`
   - `guru_apppilot=true`
   - `guru_apppilot_root_name=<root>` when a root is configured
3. Unity connects to AppPilot through the existing framework client websocket.
4. Unity starts its app-side websocket server through the existing framework server websocket.
5. Unity sends `guru_server_ip_port` to AppPilot over the first connection.
6. AppPilot reverse-connects to the app-side websocket and sends AppPilot RPC calls there.

## PC Methods

Unity app -> AppPilot:

```json
{"jsonrpc":"2.0","id":1,"method":"guru_server_ip_port","params":{"data":"192.168.5.12:8080"}}
```

AppPilot returns:

```json
{"jsonrpc":"2.0","id":1,"result":{"ok":true}}
```

Optional hello:

```json
{"jsonrpc":"2.0","id":2,"method":"guru.apppilot.hello","params":{"version":"1"}}
```

## App-Side Methods

AppPilot -> Unity app-side server:

- `guru.apppilot.ping`
- `guru.apppilot.queryNodes`
- `guru.apppilot.getNodeAttrs`

`queryNodes` is a partial hierarchy query. Default projection should be small:

```json
{
  "rootPath": "",
  "depth": 1,
  "where": [{"field":"name","op":"contains","value":"Button"}],
  "select": ["path"],
  "limit": 100
}
```

When `select` contains `children`, children should be returned as child tokens only:

```json
{
  "nodes": [
    {
      "path": "Canvas#0",
      "children": ["Header#0", "Content#0"]
    }
  ],
  "truncated": false
}
```

`getNodeAttrs` returns coordinates and opt-in debug fields for one path:

```json
{
  "path": "Canvas#0/Header#0/PlayButton#0",
  "select": ["rect", "text", "active", "components"]
}
```
