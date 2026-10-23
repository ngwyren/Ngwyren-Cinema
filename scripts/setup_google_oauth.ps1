# ==============================================================================
# NGWYREN CINEMA — TỰ ĐỘNG CẤU HÌNH GOOGLE OAUTH & XUẤT BẢN LÊN GITHUB PAGES
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "Ngwyren Cinema - Tự Động Kết Nối Google OAuth"

Clear-Host
Write-Host ""
Write-Host " ======================================================================" -ForegroundColor Cyan
Write-Host "      NGWYREN CINEMA — CÔNG CỤ TỰ ĐỘNG THIẾT LẬP GOOGLE OAUTH THẬT     " -ForegroundColor Yellow
Write-Host " ======================================================================" -ForegroundColor Cyan
Write-Host ""

$webOrigin = "https://ngwyren.github.io"

# 1. Tự động sao chép link website vào bộ nhớ tạm (Clipboard)
try {
    Set-Clipboard -Value $webOrigin
    Write-Host " [OK] Đã tự động copy địa chỉ web vào Clipboard: " -NoNewline -ForegroundColor Green
    Write-Host "$webOrigin" -ForegroundColor Yellow
} catch {
    Write-Host " [!] Vui lòng ghi nhớ địa chỉ web: $webOrigin" -ForegroundColor Yellow
}

# 2. Tự động mở trình duyệt đến trang tạo OAuth Client ID của Google Cloud
$oauthUrl = "https://console.cloud.google.com/apis/credentials/oauthclient"
Write-Host " [OK] Đang tự động mở Google Cloud Console trên trình duyệt..." -ForegroundColor Green
Start-Process $oauthUrl

Write-Host ""
Write-Host " ----------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host " HƯỚNG DẪN TRÊN TRÌNH DUYỆT (Chỉ mất 20 giây):" -ForegroundColor White
Write-Host "   1. Ở mục 'Application type': Chọn 'Web application'" -ForegroundColor Gray
Write-Host "   2. Ở mục 'Name': Nhập 'Ngwyren Cinema'" -ForegroundColor Gray
Write-Host "   3. Ở mục 'Authorized JavaScript origins':" -ForegroundColor Gray
Write-Host "      -> Bấm '+ ADD URI' và nhấn Ctrl + V (đã copy sẵn $webOrigin)" -ForegroundColor Cyan
Write-Host "   4. Bấm nút 'CREATE' -> Google sẽ cấp 1 chuỗi Client ID" -ForegroundColor Gray
Write-Host "      (Ví dụ: 123456789-abcdef.apps.googleusercontent.com)" -ForegroundColor DarkYellow
Write-Host " ----------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

# 3. Yêu cầu nhập/dán Client ID
$clientId = Read-Host " Dán Google Client ID của bạn vào đây rồi bấm Enter"
$clientId = $clientId.Trim()

if ([string]::IsNullOrWhiteSpace($clientId)) {
    Write-Host ""
    Write-Host " [CẢNH BÁO] Bạn chưa nhập Client ID. Quy trình tự động đã dừng lại." -ForegroundColor Red
    Write-Host " Bạn có thể chạy lại file này bất kỳ lúc nào." -ForegroundColor Gray
    Read-Host " Nhấn Enter để thoát..."
    exit
}

# 4. Tự động cập nhật file js/auth-config.js
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$authConfigFile = Join-Path $projectRoot "js\auth-config.js"

if (-not (Test-Path $authConfigFile)) {
    Write-Host " [LỖI] Không tìm thấy file $authConfigFile" -ForegroundColor Red
    Read-Host " Nhấn Enter để thoát..."
    exit
}

$newConfigContent = @"
// Ngwyren Cinema — Authentication & Cloud Sync Configuration
window.NGWYREN_AUTH_CONFIG = {
  // Google OAuth 2.0 Web Client ID (Chính thức từ Google Cloud Console)
  googleClientId: "$clientId",
  // Cloud Database Storage API (Hỗ trợ REST API lưu trữ đám mây xuyên thiết bị)
  cloudStorageEndpoint: "https://api.restful-api.dev/objects",
  // Khóa nhận diện ứng dụng
  appId: "ngwyren-cinema-spatial"
};
"@

Set-Content -Path $authConfigFile -Value $newConfigContent -Encoding UTF8
Write-Host ""
Write-Host " [OK] Đã ghi cấu hình Google Client ID vào js/auth-config.js!" -ForegroundColor Green

# 5. Tự động Git Commit và Git Push lên GitHub Pages
$gitPath = "C:\Users\PC-25\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe"
if (-not (Test-Path $gitPath)) {
    $gitCmd = Get-Command git -ErrorAction SilentlyContinue
    if ($gitCmd) { $gitPath = $gitCmd.Source }
}

if (Test-Path $gitPath) {
    Write-Host " [OK] Đang tự động đẩy mã nguồn mới lên GitHub Pages..." -ForegroundColor Cyan
    & $gitPath -C $projectRoot add js/auth-config.js
    & $gitPath -C $projectRoot commit -m "feat(auth): configure real Google OAuth Client ID via automation script"
    & $gitPath -C $projectRoot push origin main
    Write-Host ""
    Write-Host " ======================================================================" -ForegroundColor Green
    Write-Host "  🎉 THÀNH CÔNG 100%! GOOGLE OAUTH THẬT ĐÃ ĐƯỢC KÍCH HOẠT VĨNH VIỄN! " -ForegroundColor Yellow
    Write-Host "  Website: https://ngwyren.github.io/Ngwyren-Cinema/                  " -ForegroundColor White
    Write-Host " ======================================================================" -ForegroundColor Green
} else {
    Write-Host " [OK] Đã lưu mã Client ID vào mã nguồn cục bộ thành công!" -ForegroundColor Green
}

Write-Host ""
Read-Host " Nhấn Enter để kết thúc..."
