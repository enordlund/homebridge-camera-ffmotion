#!/bin/bash
mkfifo /tmp/motion/motion-pipe
chmod 777 /tmp/motion/motion-pipe
chown pi:pi /tmp/motion/motion-pipe
