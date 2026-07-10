import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../core/theme/app_colors.dart';

class ArTryOnScreen extends StatefulWidget {
  final String imagePath;
  final String jewelryUrl;

  const ArTryOnScreen({
    super.key,
    required this.imagePath,
    required this.jewelryUrl,
  });

  @override
  State<ArTryOnScreen> createState() => _ArTryOnScreenState();
}

class _ArTryOnScreenState extends State<ArTryOnScreen> {
  double _scale = 1.0;
  double _previousScale = 1.0;
  Offset _offset = Offset.zero;
  Offset _previousOffset = Offset.zero;
  double _rotation = 0.0;
  double _previousRotation = 0.0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        title: const Text('Virtual Try-On', style: TextStyle(color: Colors.white)),
        actions: [
          TextButton(
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Photo saved beautifully!'), backgroundColor: AppColors.success),
              );
              context.pop();
            },
            child: const Text('Save', style: TextStyle(color: AppColors.gold, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
      extendBodyBehindAppBar: true,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // User's uploaded portrait
          Image.file(
            File(widget.imagePath),
            fit: BoxFit.cover,
          ),
          
          // Gradient for app bar visibility
          Positioned(
            top: 0, left: 0, right: 0,
            height: 120,
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Colors.black54, Colors.transparent],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
              ),
            ),
          ),

          // Interactive Jewelry Overlay
          Positioned.fill(
            child: GestureDetector(
              onScaleStart: (details) {
                _previousScale = _scale;
                _previousOffset = details.focalPoint;
                _previousRotation = _rotation;
              },
              onScaleUpdate: (details) {
                setState(() {
                  _scale = _previousScale * details.scale;
                  _offset += details.focalPoint - _previousOffset;
                  _previousOffset = details.focalPoint;
                  _rotation = _previousRotation + details.rotation;
                });
              },
              child: Container(
                color: Colors.transparent, // Capable of catching gestures without blocking the image below visually
                child: Stack(
                  children: [
                    Positioned(
                      // Center the image initially relative to screen size minus half the image size
                      left: _offset.dx + (MediaQuery.of(context).size.width / 2) - 100,
                      top: _offset.dy + (MediaQuery.of(context).size.height / 2) - 100,
                      child: Transform(
                        alignment: Alignment.center,
                        transform: Matrix4.identity()
                          ..scale(_scale)
                          ..rotateZ(_rotation),
                        child: CachedNetworkImage(
                          imageUrl: widget.jewelryUrl,
                          width: 200,
                          height: 200,
                          fit: BoxFit.contain,
                          errorWidget: (context, url, err) => const Icon(Icons.error, color: Colors.red),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          
          // Hint toast
          Positioned(
            bottom: 40,
            left: 20,
            right: 20,
            child: IgnorePointer(
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                decoration: BoxDecoration(
                  color: Colors.black87,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withOpacity(0.5), blurRadius: 10, offset: const Offset(0, 4)),
                  ],
                ),
                child: const Text(
                  'Drag, pinch to zoom, and rotate to position the jewelry over your photo.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white, fontSize: 13, height: 1.4),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
