#!/usr/bin/env pwsh

<#
.SYNOPSIS
Analyzes TypeScript files and counts lines of code excluding JSX/HTML content.

.DESCRIPTION
This script recursively finds all .ts and .tsx files in the current directory and subdirectories,
then analyzes each file to count only pure TypeScript/JavaScript lines of code, excluding:
- JSX/HTML elements and tags
- JSX fragments
- Multi-line JSX return blocks
- Comments and empty lines
- JSX attributes and props

.PARAMETER Path
The root path to analyze. Defaults to current directory.

.PARAMETER Detailed
Show detailed breakdown per file.

.PARAMETER ExcludeDirs
Directories to exclude from analysis. Defaults to common non-source directories.

.EXAMPLE
.\analyze-typescript-loc.ps1
Analyzes all TypeScript files in current directory with summary only.

.EXAMPLE
.\analyze-typescript-loc.ps1 -Detailed
Shows detailed per-file breakdown along with summary.

.EXAMPLE
.\analyze-typescript-loc.ps1 -Path "frontend" -Detailed
Analyzes only the frontend directory with detailed output.
#>

param(
    [string]$Path = ".",
    [switch]$Detailed,
    [string[]]$ExcludeDirs = @("node_modules", ".git", "dist", "build", ".next", "coverage", ".vscode")
)

# Color functions for better output
function Write-ColorText {
    param(
        [string]$Text,
        [string]$Color = "White"
    )
    Write-Host $Text -ForegroundColor $Color
}

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-ColorText "=" * 80 -Color "Cyan"
    Write-ColorText " $Text" -Color "Yellow"
    Write-ColorText "=" * 80 -Color "Cyan"
}

function Write-Subheader {
    param([string]$Text)
    Write-Host ""
    Write-ColorText "-" * 60 -Color "DarkCyan"
    Write-ColorText " $Text" -Color "Green"
    Write-ColorText "-" * 60 -Color "DarkCyan"
}

# Initialize counters
$script:TotalFiles = 0
$script:TotalLines = 0
$script:TotalCodeLines = 0
$script:TotalJsxLines = 0
$script:TotalCommentLines = 0
$script:TotalEmptyLines = 0
$script:FileResults = @()

function Test-IsJsxLine {
    param([string]$Line)
    
    $trimmed = $Line.Trim()
    
    # Empty lines
    if ($trimmed -eq "") { return $false }
    
    # Comments (single line and multi-line)
    if ($trimmed -match "^\s*//|^\s*/\*|^\s*\*") { return $false }
    
    # JSX Elements - opening, closing, and self-closing tags
    if ($trimmed -match "</?[A-Za-z][A-Za-z0-9]*(\s+[^>]*)?>|<[A-Za-z][A-Za-z0-9]*(\s+[^>]*)?/>") { return $true }
    
    # JSX Fragments
    if ($trimmed -match "^\s*<>|^\s*</>") { return $true }
    
    # Lines that are primarily JSX attributes (className, onClick, etc.)
    if ($trimmed -match "^\s*(className|onClick|onChange|onSubmit|onFocus|onBlur|onKeyDown|onMouseDown|style|id|key|ref|type|value|placeholder|disabled|required|aria-\w+)=") { return $true }
    
    # Lines that end with JSX-like syntax (>, />, })
    if ($trimmed -match "^\s*[^=]*[>}]\s*$" -and $trimmed -match "(>|/>|}\s*>)$") { return $true }
    
    # JSX prop spreading
    if ($trimmed -match "^\s*\.\.\.[a-zA-Z_$][a-zA-Z0-9_$]*\s*$") { return $true }
    
    return $false
}

function Test-IsCommentLine {
    param([string]$Line)
    
    $trimmed = $Line.Trim()
    return $trimmed -match "^\s*//|^\s*/\*|^\s*\*"
}

function Test-IsEmptyLine {
    param([string]$Line)
    
    return $Line.Trim() -eq ""
}

function Test-IsCodeLine {
    param([string]$Line)
    
    $trimmed = $Line.Trim()
    
    # Empty lines
    if ($trimmed -eq "") { return $false }
    
    # Comments
    if (Test-IsCommentLine $Line) { return $false }
    
    # JSX content
    if (Test-IsJsxLine $Line) { return $false }
    
    # Lines with only braces/brackets (often JSX structure)
    if ($trimmed -match "^\s*[{}()\[\]]\s*$") { return $false }
    
    # Lines that are just JSX closing syntax
    if ($trimmed -match "^\s*[);]\s*$") { return $false }
    
    return $true
}

function Analyze-TypeScriptFile {
    param([string]$FilePath)
    
    try {
        $content = Get-Content $FilePath -ErrorAction Stop
        $totalLines = $content.Count
        $codeLines = 0
        $jsxLines = 0
        $commentLines = 0
        $emptyLines = 0
        
        $inMultiLineComment = $false
        $inJsxBlock = $false
        $jsxBraceDepth = 0
        
        foreach ($line in $content) {
            $trimmed = $line.Trim()
            
            # Handle multi-line comments
            if ($inMultiLineComment) {
                $commentLines++
                if ($trimmed -match "\*/") {
                    $inMultiLineComment = $false
                }
                continue
            }
            
            if ($trimmed -match "/\*" -and $trimmed -notmatch "\*/") {
                $inMultiLineComment = $true
                $commentLines++
                continue
            }
            
            # Categorize the line
            if (Test-IsEmptyLine $line) {
                $emptyLines++
            }
            elseif (Test-IsCommentLine $line) {
                $commentLines++
            }
            elseif (Test-IsJsxLine $line) {
                $jsxLines++
            }
            else {
                # Special handling for return statements that might start JSX blocks
                if ($trimmed -match "return\s*\(" -or $trimmed -match "^\s*\(\s*$") {
                    $inJsxBlock = $true
                    $jsxBraceDepth = 1
                    $codeLines++
                    continue
                }
                
                # If we're in a JSX block, track brace depth
                if ($inJsxBlock) {
                    $openBraces = ([regex]::Matches($line, "\(")).Count
                    $closeBraces = ([regex]::Matches($line, "\)")).Count
                    $jsxBraceDepth += $openBraces - $closeBraces
                    
                    if ($jsxBraceDepth -le 0) {
                        $inJsxBlock = $false
                        $jsxBraceDepth = 0
                    }
                    
                    # If the line contains JSX elements, count as JSX
                    if (Test-IsJsxLine $line) {
                        $jsxLines++
                    }
                    else {
                        $codeLines++
                    }
                }
                else {
                    # Regular TypeScript/JavaScript code
                    if (Test-IsCodeLine $line) {
                        $codeLines++
                    }
                    else {
                        $jsxLines++
                    }
                }
            }
        }
        
        return @{
            FilePath = $FilePath
            TotalLines = $totalLines
            CodeLines = $codeLines
            JsxLines = $jsxLines
            CommentLines = $commentLines
            EmptyLines = $emptyLines
        }
    }
    catch {
        Write-Warning "Error analyzing file ${FilePath}: $($_.Exception.Message)"
        return $null
    }
}

function Get-TypeScriptFiles {
    param([string]$SearchPath)
    
    $excludePattern = ($ExcludeDirs | ForEach-Object { [regex]::Escape($_) }) -join "|"
    
    Get-ChildItem -Path $SearchPath -Recurse -Include "*.ts", "*.tsx" | 
        Where-Object { 
            $_.FullName -notmatch "($excludePattern)" -and 
            -not $_.PSIsContainer 
        }
}

# Main execution
Write-Header "TypeScript Lines of Code Analysis"

if (-not (Test-Path $Path)) {
    Write-ColorText "Error: Path '$Path' does not exist." -Color "Red"
    exit 1
}

$resolvedPath = Resolve-Path $Path
Write-ColorText "Analyzing TypeScript files in: $resolvedPath" -Color "White"
Write-ColorText "Excluded directories: $($ExcludeDirs -join ', ')" -Color "Gray"

# Find all TypeScript files
$tsFiles = Get-TypeScriptFiles $resolvedPath

if ($tsFiles.Count -eq 0) {
    Write-ColorText "No TypeScript files found in the specified path." -Color "Yellow"
    exit 0
}

Write-ColorText "Found $($tsFiles.Count) TypeScript files to analyze..." -Color "Green"
Write-Host ""

# Analyze each file
$progressCount = 0
foreach ($file in $tsFiles) {
    $progressCount++
    Write-Progress -Activity "Analyzing TypeScript files" -Status "Processing $($file.Name)" -PercentComplete (($progressCount / $tsFiles.Count) * 100)
    
    $result = Analyze-TypeScriptFile $file.FullName
    if ($result) {
        $script:FileResults += $result
        $script:TotalFiles++
        $script:TotalLines += $result.TotalLines
        $script:TotalCodeLines += $result.CodeLines
        $script:TotalJsxLines += $result.JsxLines
        $script:TotalCommentLines += $result.CommentLines
        $script:TotalEmptyLines += $result.EmptyLines
    }
}

Write-Progress -Completed -Activity "Analyzing TypeScript files"

# Display results
if ($Detailed) {
    Write-Subheader "Detailed File Analysis"
    
    $FileResults | Sort-Object FilePath | ForEach-Object {
        $relativePath = $_.FilePath -replace [regex]::Escape($resolvedPath), "."
        $codePercentage = if ($_.TotalLines -gt 0) { [math]::Round(($_.CodeLines / $_.TotalLines) * 100, 1) } else { 0 }
        
        Write-Host ""
        Write-ColorText "File: $relativePath" -Color "Cyan"
        Write-ColorText "  Total Lines: $($_.TotalLines)" -Color "White"
        Write-ColorText "  Code Lines: $($_.CodeLines) ($codePercentage%)" -Color "Green"
        Write-ColorText "  JSX/HTML Lines: $($_.JsxLines)" -Color "Magenta"
        Write-ColorText "  Comment Lines: $($_.CommentLines)" -Color "Gray"
        Write-ColorText "  Empty Lines: $($_.EmptyLines)" -Color "DarkGray"
    }
}

# Summary statistics
Write-Subheader "Summary Statistics"

$overallCodePercentage = if ($TotalLines -gt 0) { [math]::Round(($TotalCodeLines / $TotalLines) * 100, 1) } else { 0 }
$jsxPercentage = if ($TotalLines -gt 0) { [math]::Round(($TotalJsxLines / $TotalLines) * 100, 1) } else { 0 }
$commentPercentage = if ($TotalLines -gt 0) { [math]::Round(($TotalCommentLines / $TotalLines) * 100, 1) } else { 0 }
$emptyPercentage = if ($TotalLines -gt 0) { [math]::Round(($TotalEmptyLines / $TotalLines) * 100, 1) } else { 0 }

Write-Host ""
Write-ColorText "📁 Total TypeScript Files: $TotalFiles" -Color "Cyan"
Write-ColorText "📄 Total Lines: $TotalLines" -Color "White"
Write-Host ""
Write-ColorText "💻 Pure Code Lines: $TotalCodeLines ($overallCodePercentage%)" -Color "Green"
Write-ColorText "🎨 JSX/HTML Lines: $TotalJsxLines ($jsxPercentage%)" -Color "Magenta"
Write-ColorText "💬 Comment Lines: $TotalCommentLines ($commentPercentage%)" -Color "Gray"
Write-ColorText "📝 Empty Lines: $TotalEmptyLines ($emptyPercentage%)" -Color "DarkGray"

# File type breakdown
Write-Subheader "File Type Breakdown"

$tsFiles = $FileResults | Where-Object { $_.FilePath -match "\.ts$" }
$tsxFiles = $FileResults | Where-Object { $_.FilePath -match "\.tsx$" }

if ($tsFiles.Count -gt 0) {
    $tsCodeLines = ($tsFiles | Measure-Object -Property CodeLines -Sum).Sum
    $tsTotalLines = ($tsFiles | Measure-Object -Property TotalLines -Sum).Sum
    $tsPercentage = if ($tsTotalLines -gt 0) { [math]::Round(($tsCodeLines / $tsTotalLines) * 100, 1) } else { 0 }
    
    Write-Host ""
    Write-ColorText ".ts files: $($tsFiles.Count)" -Color "Blue"
    Write-ColorText "  Total Lines: $tsTotalLines" -Color "White"
    Write-ColorText "  Code Lines: $tsCodeLines ($tsPercentage%)" -Color "Green"
}

if ($tsxFiles.Count -gt 0) {
    $tsxCodeLines = ($tsxFiles | Measure-Object -Property CodeLines -Sum).Sum
    $tsxTotalLines = ($tsxFiles | Measure-Object -Property TotalLines -Sum).Sum
    $tsxJsxLines = ($tsxFiles | Measure-Object -Property JsxLines -Sum).Sum
    $tsxPercentage = if ($tsxTotalLines -gt 0) { [math]::Round(($tsxCodeLines / $tsxTotalLines) * 100, 1) } else { 0 }
    $tsxJsxPercentage = if ($tsxTotalLines -gt 0) { [math]::Round(($tsxJsxLines / $tsxTotalLines) * 100, 1) } else { 0 }
    
    Write-Host ""
    Write-ColorText ".tsx files: $($tsxFiles.Count)" -Color "Magenta"
    Write-ColorText "  Total Lines: $tsxTotalLines" -Color "White"
    Write-ColorText "  Code Lines: $tsxCodeLines ($tsxPercentage%)" -Color "Green"
    Write-ColorText "  JSX Lines: $tsxJsxLines ($tsxJsxPercentage%)" -Color "Magenta"
}

Write-Header "Analysis Complete"
Write-ColorText "✅ Total Pure TypeScript/JavaScript Code Lines: $TotalCodeLines" -Color "Green"

# Export results to CSV if requested
if ($env:EXPORT_CSV -eq "true") {
    $csvPath = "typescript-loc-analysis.csv"
    $FileResults | Export-Csv -Path $csvPath -NoTypeInformation
    Write-ColorText "📊 Results exported to: $csvPath" -Color "Yellow"
}
