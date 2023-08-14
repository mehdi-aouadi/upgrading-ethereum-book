#!/bin/bash

#
# Apply a git commit to all branches
#

branches='altair bellatrix capella'

if [ $# -eq 0 ]; then
    echo "Usage: $0 <commit>"
    exit 1
fi

# Save the starting branch so we can return to it later
start=$(git branch --show-current)

for branch in $branches;
do
    echo "*** Patching $branch"
    git switch $branch && git cherry-pick $1
    if [ $? -ne 0 ]
    then
        echo "*** Cherry pick failed on $branch"
        echo "*** Aborting"
        git cherry-pick --abort
    fi
done

git switch $start