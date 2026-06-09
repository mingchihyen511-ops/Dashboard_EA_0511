# Apps Script Versioning

This folder stores the Google Apps Script source used by the dashboard API.

## Files

- `Record_5000M_current.txt`: original script exported from the current Google Apps Script project.
- `Record_5000M_v10_decision.gs`: proposed replacement version with header-based column lookup and decision/risk fields.

## Deployment Notes

When updating Google Apps Script:

1. Paste the selected `.gs` source into the Apps Script editor.
2. Deploy a new Web App version.
3. Record the deployed Web App URL in the workbook `app script` sheet.
4. Commit the updated source here before changing `index.html` API defaults.

## Supported Endpoints

- `query_history`
- `get_latest`
- `get_strategy_info`

## Deployments

- v10: `https://script.google.com/macros/s/AKfycbxwKgM6YfN7eJt4Li-M19ewj9keGyIaZz10zi6uyo0jURGtUVWqoIPUX1nHeJIQf8Fdtg/exec`
