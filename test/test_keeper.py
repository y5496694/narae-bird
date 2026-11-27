import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('keeper', Path(__file__).resolve().parents[1] / 'ops/caddy-route-keeper.py')
keeper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(keeper)

class KeeperTests(unittest.TestCase):
    def test_hide_set_order_does_not_reload_live_connections(self):
        current = {'apps': {'http': {'routes': [{'handler': 'file_server', 'hide': ['/b', '/a']}]}}}
        desired = {'apps': {'http': {'routes': [{'hide': ['/a', '/b'], 'handler': 'file_server'}]}}}
        with patch.object(keeper, 'current_config', return_value=current), patch.object(keeper, 'desired_config', return_value=desired), patch.object(keeper, 'load_config') as load:
            self.assertFalse(keeper.reconcile())
            load.assert_not_called()

    def test_actual_route_order_change_is_not_hidden(self):
        first = {'routes': [{'id': 'protected'}, {'id': 'fallback'}]}
        second = {'routes': [{'id': 'fallback'}, {'id': 'protected'}]}
        self.assertNotEqual(keeper.canonical(first), keeper.canonical(second))
        with patch.object(keeper, 'current_config', return_value=first), patch.object(keeper, 'desired_config', return_value=second), patch.object(keeper, 'load_config', return_value=200) as load:
            self.assertTrue(keeper.reconcile())
            load.assert_called_once_with(second)

if __name__ == '__main__':
    unittest.main()
