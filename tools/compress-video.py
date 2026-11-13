#!/usr/bin/env python3
"""生成 Pages 用视频；保留分辨率、帧时间和原音轨，不覆盖输入或已有输出。"""
import argparse
import json
from pathlib import Path
import subprocess

CRF = 18
MAXRATE = "6800k"
LIMIT_BYTES = 25 * 1024 * 1024

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--start", type=float, default=0)
    parser.add_argument("--duration", type=float)
    parser.add_argument("--crf", type=int, default=CRF)
    args = parser.parse_args()
    if args.output.exists() or args.input.resolve() == args.output.resolve():
        parser.error("输出必须是新文件，不能覆盖原素材")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["ffmpeg", "-nostdin", "-n", "-hide_banner", "-loglevel", "warning"]
    if args.start:
        cmd += ["-ss", str(args.start)]
    cmd += ["-i", str(args.input)]
    if args.duration:
        cmd += ["-t", str(args.duration)]
    cmd += ["-map", "0:v:0", "-map", "0:a?", "-c:v", "libx264",
            "-preset", "slow", "-crf", str(args.crf), "-maxrate", MAXRATE,
            "-bufsize", MAXRATE, "-pix_fmt", "yuv420p", "-fps_mode", "passthrough",
            "-enc_time_base", "1:19200", "-video_track_timescale", "19200",
            "-c:a", "copy", "-movflags", "+faststart", str(args.output)]
    subprocess.run(cmd, check=True, timeout=600)
    size = args.output.stat().st_size
    print(json.dumps({"output": str(args.output), "bytes": size,
                      "MiB": round(size / 1024**2, 3), "limitBytes": LIMIT_BYTES,
                      "crf": args.crf, "maxrate": MAXRATE}, ensure_ascii=False))
    if size >= LIMIT_BYTES:
        raise SystemExit("输出仍超出 Pages 限制，请调整参数后写到新文件")

if __name__ == "__main__":
    main()
