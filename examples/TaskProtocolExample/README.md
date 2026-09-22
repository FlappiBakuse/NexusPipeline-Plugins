# TaskProtocolExample

Structure preset: json-id-array

Synthetic protocol fixture; config.tasks entries are {id,name,enabled}. Logs use TASK <id> START|OK|FAIL. Run via the Host task protocol integration tool.

Protocol 1.1 freezes plugin-owned task/reason dictionaries. User names remain literal. The synthetic daily-reward entry uses its plugin key only with builtin=true; customName always overrides it.
