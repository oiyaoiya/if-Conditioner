# if #ifdef conditioner
A simple extension that to turn code blocks into active or inactive states.

## Features

### Active code blocks
1. Select a pre defined symbol
2. Press keys
  - window, linux: `shift + win + c`
  - mac: `shift + command + c`
3. Set value for pre defined symbol as higher than 0

### Inactive code blocks
1. Select a pre defined symbol
2. Press keys
  - window, linux: `shift + win + c`
  - mac: `shift + command + c`
3. Set value for pre defined symbol as 0
4. If you did set value for the selected symbol, Select "Modify" menu and set value as 0

## Extension Settings
```
{
    "if-conditioner.symbols": [
        {
            "symbol": "TEST",
            "val": 0
        }
    ],
}
```

