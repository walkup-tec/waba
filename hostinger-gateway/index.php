<?php
/**
 * Gateway Hostinger → VPS EasyPanel (waba_disparador).
 * O FTP sobe o bundle sem index; sem este arquivo o LiteSpeed lista a pasta.
 */
$backends = array(
  "http://72.60.51.127:30180",
  "https://72.60.51.127",
);
$uri = isset($_SERVER["REQUEST_URI"]) ? $_SERVER["REQUEST_URI"] : "/";
$method = isset($_SERVER["REQUEST_METHOD"]) ? $_SERVER["REQUEST_METHOD"] : "GET";
$body = file_get_contents("php://input");
if ($body === false) {
  $body = "";
}

$reqHeaders = array("Host: waba.draxsistemas.com.br");
if (!empty($_SERVER["REMOTE_ADDR"])) {
  $reqHeaders[] = "X-Forwarded-For: " . $_SERVER["REMOTE_ADDR"];
}
$reqHeaders[] = "X-Forwarded-Proto: https";
if (function_exists("getallheaders")) {
  foreach (getallheaders() as $name => $value) {
    $key = strtolower((string) $name);
    if ($key === "host" || $key === "content-length" || $key === "connection") {
      continue;
    }
    $reqHeaders[] = $name . ": " . $value;
  }
}

$raw = false;
$error = "";
foreach ($backends as $base) {
  $ch = curl_init($base . $uri);
  $opts = array(
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_HTTPHEADER => $reqHeaders,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER => true,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_TIMEOUT => 120,
    CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => 0,
  );
  if ($body !== "" || $method === "POST" || $method === "PUT" || $method === "PATCH") {
    $opts[CURLOPT_POSTFIELDS] = $body;
  }
  curl_setopt_array($ch, $opts);
  $raw = curl_exec($ch);
  $error = curl_error($ch);
  $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  if ($raw !== false && $code > 0) {
    break;
  }
  $raw = false;
}

if ($raw === false) {
  $path = parse_url($uri, PHP_URL_PATH);
  $fallback = __DIR__ . "/index.html";
  if ($method === "GET" && ($path === "/" || $path === "" || $path === "/index.php") && is_file($fallback)) {
    header("Content-Type: text/html; charset=UTF-8");
    readfile($fallback);
    exit;
  }
  header("HTTP/1.1 502 Bad Gateway");
  header("Content-Type: text/plain; charset=UTF-8");
  echo "Sistema temporariamente indisponivel.";
  if ($error) {
    echo "\n";
  }
  exit;
}

$split = strpos($raw, "\r\n\r\n");
if ($split === false) {
  $split = strpos($raw, "\n\n");
  $headerText = $split === false ? "" : substr($raw, 0, $split);
  $respBody = $split === false ? $raw : substr($raw, $split + 2);
} else {
  $headerText = substr($raw, 0, $split);
  $respBody = substr($raw, $split + 4);
}

$hop = array("transfer-encoding" => 1, "connection" => 1, "keep-alive" => 1);
foreach (explode("\n", str_replace("\r", "", $headerText)) as $line) {
  $line = trim($line);
  if ($line === "" || stripos($line, "HTTP/") === 0) {
    if (stripos($line, "HTTP/") === 0) {
      header($line);
    }
    continue;
  }
  $colon = strpos($line, ":");
  if ($colon === false) {
    continue;
  }
  $name = strtolower(substr($line, 0, $colon));
  if (isset($hop[$name])) {
    continue;
  }
  header($line, false);
}
echo $respBody;
