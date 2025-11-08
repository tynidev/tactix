# URL Cycler PowerShell Script - User Behavior Simulation
# This script cycles through URLs to simulate real users accessing your frontend

param(
    [int]$MinInterval = 15,      # Minimum interval in seconds
    [int]$MaxInterval = (60*5),     # Maximum interval in seconds (5 minutes)
    [double]$InteractionDelay = 2.5,  # Time to "interact" on each page
    [string]$BaseUrl = "https://tactix-frontend-orpin.vercel.app"
)

# Add required assemblies for browser control
Add-Type -AssemblyName System.Windows.Forms

# User behavior patterns - weighted URLs based on typical user flows
$userJourneys = @{
    # Entry points (higher weight for common landing pages)
    "landing" = @(
        @{ url = "/games"; weight = 40; description = "Games List (Main Hub)" },
        @{ url = "/teams"; weight = 25; description = "Teams Overview" },
        @{ url = "/dashboard"; weight = 20; description = "Dashboard" },
        @{ url = "/profile"; weight = 15; description = "User Profile" }
    )
    
    # Team exploration flow
    "team_flow" = @(
        @{ url = "/teams"; weight = 100; description = "Teams List" },
        @{ url = "/team/570f0489-19b2-40d1-9305-a012e9d26470"; weight = 60; description = "Team Detail" },
        @{ url = "/games/570f0489-19b2-40d1-9305-a012e9d26470"; weight = 80; description = "Team Games" },
        @{ url = "/team/534762fb-89cf-4cca-acb5-606a5974e47c"; weight = 40; description = "Another Team" },
        @{ url = "/games/534762fb-89cf-4cca-acb5-606a5974e47c"; weight = 50; description = "Another Team Games" }
    )
    
    # Game analysis flow (most engaged users)
    "analysis_flow" = @(
        @{ url = "/games"; weight = 100; description = "Games List" },
        @{ url = "/review"; weight = 70; description = "Review Selection" },
        @{ url = "/games/570f0489-19b2-40d1-9305-a012e9d26470"; weight = 90; description = "Team Games" },
        @{ url = "/analytics"; weight = 100; description = "Team Analytics" }

    )
    
    # Profile management
    "profile_flow" = @(
        @{ url = "/profile"; weight = 100; description = "User Profile" },
        @{ url = "/teams"; weight = 60; description = "Back to Teams" },
        @{ url = "/games"; weight = 40; description = "Back to Games" }
    )
}

# Function to select weighted random URL from a journey
function Get-WeightedRandomUrl {
    param([array]$urls)
    
    $totalWeight = ($urls | Measure-Object -Property weight -Sum).Sum
    $random = Get-Random -Minimum 0 -Maximum $totalWeight
    $current = 0
    
    foreach ($item in $urls) {
        $current += $item.weight
        if ($random -lt $current) {
            return $item
        }
    }
    
    return $urls[0]  # Fallback
}

# Function to simulate user interaction delays
function Simulate-UserInteraction {
    param([string]$pageType)
    
    $baseDelay = $InteractionDelay
    
    # Different pages have different "reading" times
    $multiplier = switch -wildcard ($pageType) {
        "*games*" { 1.5 }     # Users spend more time browsing games
        "*team*" { 1.3 }      # Teams require some analysis
        "*review*" { 2.0 }    # Analysis takes longer
        "*profile*" { 0.8 }   # Quick profile checks
        default { 1.0 }
    }
    
    $delay = $baseDelay * $multiplier + (Get-Random -Minimum 0.5 -Maximum 2.0)
    Start-Sleep -Seconds $delay
}

# Function to navigate to URL in existing browser window
function Navigate-ToBrowser {
    param([string]$url, [string]$description)
    
    $fullUrl = if ($url.StartsWith("http")) { $url } else { "$BaseUrl$url" }
    
    # Copy URL to clipboard
    Set-Clipboard -Value $fullUrl
    
    # Send Ctrl+L to focus address bar, then Ctrl+V to paste URL, then Enter
    [System.Windows.Forms.SendKeys]::SendWait("^l")
    Start-Sleep -Milliseconds 300
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Milliseconds 200
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    
    Write-Host "  → Navigating to: $description" -ForegroundColor Cyan
    Write-Host "    $fullUrl" -ForegroundColor Gray
}

# Function to simulate realistic user session
function Start-UserSession {
    param([int]$sessionLength = 5)  # Number of pages in this session
    
    # Start with a landing page
    $currentUrl = Get-WeightedRandomUrl -urls $userJourneys.landing
    Navigate-ToBrowser -url $currentUrl.url -description $currentUrl.description
    Simulate-UserInteraction -pageType $currentUrl.url
    
    # Continue with journey-based navigation
    for ($i = 1; $i -lt $sessionLength; $i++) {
        # Choose next journey based on current context
        $nextJourney = switch -wildcard ($currentUrl.url) {
            "*team*" { "team_flow" }
            "*games*" { Get-Random -InputObject @("team_flow", "analysis_flow") }
            "*profile*" { "profile_flow" }
            default { Get-Random -InputObject @("landing", "team_flow") }
        }
        
        $nextUrl = Get-WeightedRandomUrl -urls $userJourneys[$nextJourney]
        Navigate-ToBrowser -url $nextUrl.url -description $nextUrl.description
        Simulate-UserInteraction -pageType $nextUrl.url
        
        $currentUrl = $nextUrl
        
        # Random micro-break between page views
        Start-Sleep -Seconds (Get-Random -Minimum 1 -Maximum 4)
    }
}

Write-Host "🎯 TACTIX User Behavior Simulator Starting..." -ForegroundColor Green
Write-Host "Base URL: $BaseUrl" -ForegroundColor Yellow
Write-Host "Session intervals: $MinInterval-$MaxInterval seconds" -ForegroundColor Yellow
Write-Host "Interaction delay: $InteractionDelay seconds (base)" -ForegroundColor Yellow
Write-Host ""
Write-Host "This simulator mimics realistic user behavior patterns:" -ForegroundColor Cyan
Write-Host "  • Weighted page selection based on user flows" -ForegroundColor Gray
Write-Host "  • Variable reading/interaction times per page type" -ForegroundColor Gray
Write-Host "  • Context-aware navigation (teams → games → analysis)" -ForegroundColor Gray
Write-Host "  • Random session lengths and break intervals" -ForegroundColor Gray
Write-Host ""
Write-Host "Make sure your browser window is active/focused!" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Red
Write-Host ""

# Start first session immediately
$sessionCounter = 1
Write-Host "🚀 Starting User Session #$sessionCounter" -ForegroundColor White
$sessionLength = Get-Random -Minimum 3 -Maximum 7
Start-UserSession -sessionLength $sessionLength

# Main simulation loop
while ($true) {
    # Random break between sessions (simulating user leaving/returning)
    $breakTime = Get-Random -Minimum $MinInterval -Maximum ($MaxInterval + 1)
    $minutes = [math]::Floor($breakTime / 60)
    $seconds = $breakTime % 60
    $formattedTime = "{0:00}:{1:00}" -f $minutes, $seconds
    
    # Calculate the next session start time
    $nextSessionTime = (Get-Date).AddSeconds($breakTime).ToString("hh:mm:ss tt")
    
    Write-Host ""
    Write-Host "💤 User break - waiting $formattedTime until next session (starts at $nextSessionTime)..." -ForegroundColor DarkGray
    Start-Sleep -Seconds $breakTime
    
    # Start next session
    $sessionCounter++
    Write-Host ""
    Write-Host "🚀 Starting User Session #$sessionCounter" -ForegroundColor White
    $sessionLength = Get-Random -Minimum 2 -Maximum 8  # Varied session lengths
    Start-UserSession -sessionLength $sessionLength
}