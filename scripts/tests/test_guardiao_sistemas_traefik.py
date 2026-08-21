import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


ENGINE = Path(__file__).resolve().parents[1] / "guardiao-sistemas-traefik-vps.py"
SPEC = importlib.util.spec_from_file_location("guardiao", ENGINE)
assert SPEC and SPEC.loader
guardiao = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(guardiao)


class GuardiaoTests(unittest.TestCase):
    def registry(self):
        return {
            "entrypoint_map": {"web": "http", "websecure": "https"},
            "isolated_projects": [
                {
                    "id": "sv",
                    "file": "sinal-verde.yaml",
                    "key_patterns": ["(?i)sinal-verde"],
                }
            ],
            "managed_services": [
                {
                    "id": "pv",
                    "key_pattern": "(?i)^waba_paginadevendas-0$",
                    "url": "http://172.17.0.1:30210/",
                }
            ],
        }

    def test_flat_easypanel_strip_and_normalize(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            isolated = {
                "http": {
                    "routers": {"https-sinal-verde-0": {"rule": "Host(`sv.test`)"}},
                    "services": {
                        "sinal-verde-0": {
                            "loadBalancer": {"servers": [{"url": "http://host:30310/"}]}
                        }
                    },
                }
            }
            (root / "sinal-verde.yaml").write_text(json.dumps(isolated), encoding="utf-8")
            main = {
                "https-sinal-verde-0": {
                    "entryPoints": ["websecure"],
                    "service": "sinal-verde-0",
                    "rule": "Host(`sv.test/`)",
                },
                "sinal-verde-0": {
                    "loadBalancer": {"servers": [{"url": "http://tasks.sv:3000/"}]}
                },
                "https-waba_paginadevendas-0": {
                    "entryPoints": ["websecure"],
                    "service": "waba_paginadevendas-0",
                    "rule": "Host(`wabadisparos.com.br/`)",
                },
                "waba_paginadevendas-0": {
                    "loadBalancer": {
                        "servers": [{"url": "http://tasks.waba_paginadevendas:3000/"}]
                    }
                },
            }

            candidate, changes, warnings = guardiao.normalize_main(
                main, self.registry(), root
            )

            self.assertFalse(warnings)
            self.assertNotIn("https-sinal-verde-0", candidate)
            self.assertNotIn("sinal-verde-0", candidate)
            router = candidate["https-waba_paginadevendas-0"]
            self.assertEqual(router["entryPoints"], ["https"])
            self.assertEqual(router["rule"], "Host(`wabadisparos.com.br`)")
            load_balancer = candidate["waba_paginadevendas-0"]["loadBalancer"]
            self.assertEqual(
                load_balancer["servers"],
                [{"url": "http://172.17.0.1:30210/"}],
            )
            self.assertTrue(load_balancer["passHostHeader"])
            self.assertGreaterEqual(len(changes), 6)

    def test_invalid_isolated_file_blocks_strip(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "sinal-verde.yaml").write_text("{broken", encoding="utf-8")
            main = {
                "https-sinal-verde-0": {
                    "entryPoints": ["https"],
                    "rule": "Host(`sv.test`)",
                }
            }

            candidate, changes, warnings = guardiao.normalize_main(
                main, self.registry(), root
            )

            self.assertIn("https-sinal-verde-0", candidate)
            self.assertFalse(changes)
            self.assertTrue(any("strip bloqueado" in warning for warning in warnings))

    def test_regression_only_when_previously_healthy_probe_breaks(self):
        acceptable = {"waba": ["200"], "sv": ["200", "302"]}
        result = guardiao.regressions(
            {"waba": "200", "sv": "502"},
            {"waba": "404", "sv": "200"},
            acceptable,
        )
        self.assertEqual(result, ["waba:200->404"])


if __name__ == "__main__":
    unittest.main()
