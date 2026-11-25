import os
import sys

# the proxy is a single module next to this folder, not an installed package
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
