#!/usr/bin/perl

# Notes:
#  - Need to install run3: sudo apt-get install libipc-run3-perl
#  - chktex manual is here: https://www.nongnu.org/chktex/ChkTeX.pdf

use strict;
use warnings;
use IPC::Run3;

$\ = "\n"; # set output record separator

my ($file) = @ARGV;
die "Usage: $0 FILE\n" if not $file;
open my $fh, '<', $file or die "Can't open $file: $!";

# Add any exclusions here by adding "-n#" where # is the warning number
my @command = ["chktex", "-q"];

# Specifically ignore some false positives.
my $ignore = qr/\$(\[1,r\))\$/;

my $latex = '';
my $inMath = 0;
while(<$fh>) {

    chomp;

    if ($inMath and !(/^\$\$/)) {
        $latex .= $_ . " % Source line $.\n";
    }

    if (/^\$\$/) {
        $inMath = !$inMath;
        $latex .=  $inMath ? "\\[\n" : "\\]\n";
        next;
    }

    while (/(^|[^\\])(\$.+?\$)/g) {
        my $ltx = $2;
        if (!($ltx =~ $ignore)) {
            $latex .= $ltx . " % Source line $.\n";
        }
    }
}

run3 @command, \$latex;